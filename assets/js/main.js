import { Socket } from "phoenix";

window.addEventListener('load', () => {

  // Init phoenix socket
  let socket = new Socket("/socket", { params: { test: 123 } });
  let channel;
  socket.connect();

  // Helper function to generate a unique call id
  const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

  // Helper function to await joining the channel, resturs response from server on channel join success
  const join_channel = (channel, call_id) => new Promise((resolve, reject) => {
    channel.join()
      .receive("ok", resp => {
        console.log(`Joined topic call:${call_id} successfully`, resp);
        resolve(resp); // Resolve with on join response from server
      })
      .receive("error", resp => {
        console.log("Unable to join topic call:${call_id}", resp);
        reject(resp);
      });
  });

  /*
    WebRTC setup for relatime audio/video chat.
  
    Most of the code below deals with signaling to establish the webRTC connection, once that is done
    the webRTC connection handles all the complexity related to the peer-2-peer networking and media streaming under the hood.
  */

  // Free STUN servers available from google
  const servers = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  // Global State
  const pc = new RTCPeerConnection(servers);
  let localStream = null;
  let remoteStream = null;

  // HTML elements
  const webcamButton = document.getElementById('webcamButton');
  const webcamVideo = document.getElementById('webcamVideo');
  const callButton = document.getElementById('callButton');
  const callInput = document.getElementById('callInput');
  const answerButton = document.getElementById('answerButton');
  const remoteVideo = document.getElementById('remoteVideo');
  const hangupButton = document.getElementById('hangupButton');

  // 1. Setup media sources
  webcamButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    remoteStream = new MediaStream();

    // Push tracks from your local stream to the peer connection
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // Set up an event listener to pull tracks from the remote peer stream when they are available
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };

    // Set the local and remote streams to video elements on the page
    webcamVideo.srcObject = localStream;
    webcamVideo.muted = true; // mute slef audio
    remoteVideo.srcObject = remoteStream;

    callButton.disabled = false;
    answerButton.disabled = false;
    webcamButton.disabled = true;
  };


  // 2. Create an offer
  // This happens when the caller initiates a call/webrtc connection
  callButton.onclick = async () => {
    const callId = uid();

    // Join channels with a topic:
    channel = socket.channel(`call:${callId}`, { type: "caller" });
    await join_channel(channel, callId);

    callInput.value = callId; // This is an unique ID, peer 2 will use this to answer to the offer made by peer 1

    /*
      Save caller candidates to db
  
      Sets up an event listener to send ICE candidates from peer-1
      to the signaling server.

      The signaling server will save these candidates and forward them to peer-2
      when peer-2 connects with the server.
  
      An ICE candidate contains a potential IP address and port pair 
      that can be used to establish a peer-2-peer connection.
  
      Your ICE candidates are generated when `pc.setLocalDescription` is called
      so this listener must be setup before calling pc.setLocalDescription.
    */
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.push("ice_candidate", { ice_candidate: event.candidate, type: "caller" }, 10000);
        console.log("Push peer 1 ice candidate", event.candidate);
      }
    };

    // Create offer
    /*
      Initiates the creation of an SDP offer for the purpose of starting a new WebRTC connection to a remote peer. 
      The SDP offer includes information about any MediaStreamTrack objects already attached to the WebRTC session, codec, and options supported by the browser, 
      and any candidates(IP/port pairs) already gathered by the ICE agent, for the purpose of being sent over the signaling channel to a potential peer to request a connection.
    */
    const offerDescription = await pc.createOffer();

    // Set the offer Description as the local Description for the RTCPeerConnection
    // This triggers the pc.onicecandidate that generates to ice candidates
    await pc.setLocalDescription(offerDescription);

    // Create a JS object which contains the SDP offer data that can be saved to firestore db collection "offerCandidates"
    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    // Save the offer to firestore db collection "offerCandidates", 
    // the offer ice candidates are saved via the "onicecandidate" event listener
    channel.push("offer", { offer }, 10000);
    console.log("Pushed offer from peer-1", offer);
    // ---------------------------------------------------

    // Update local RTCPeerConnection with answer from remote peer
    /* 
      Callback to be fired whenever the offer doc that we created in firestore changes.
      Here we are listening for answer to our offer and updating our local RTCPeerConnection object
      with the answer. 
    */
    channel.on("answer", ({ answer }) => {
      console.log("Received Answer from peer-2", answer);
      const answerDescription = new RTCSessionDescription(answer);
      pc.setRemoteDescription(answerDescription);
    });

    /*
      Here we setup a listener on the signaling server channel to listen for ice candidates from peer-2.
      Once peer-2 ice candidates are available we add them to the RTCPeerConnection object
    */
    channel.on("ice_candidate", ({ ice_candidate }) => {
      console.log("Received ICE candidate for peer 2", answer);
      const candidate = new RTCIceCandidate(ice_candidate);
      pc.addIceCandidate(candidate);
    });

    hangupButton.disabled = false;
  };

  // -----------------------------------------------------------------------


  // 3. Answer the call with the unique ID, this happens on the remote peer/peer-2
  answerButton.onclick = async () => {
    const callId = callInput.value;
    let caller_candidates;
    // TODO: Fix duplicate channel join
    if (!channel) {
      // Join channels with a topic:
      channel = socket.channel(`call:${callId}`, { type: "callee" });
      caller_candidates = await join_channel(channel, callId);
      console.log(`Got ${caller_candidates.length} ice candidates from caller on channel join`, caller_candidates);
    }

    const offer = await new Promise((resolve, reject) => {
      return channel.push("get_offer", {}, 10000)
        .receive("ok", (offer) => resolve(offer))
        .receive("error", reasons => reject(reasons))
        .receive("timeout", () => reject("Networking issue..."));
    });

    console.log("Got offer from caller", offer);

    if (!offer) {
      channel.leave();
      alert("Invalid call Id");
      return;
    }

    // Send callee/remote-peer ice candidates to signaling server, these are send to the caller by the signaling server
    pc.onicecandidate = (event) => {
      if (event.candidate) channel.push("ice_candidate", { ice_candidate: event.candidate, type: "callee" }, 10000);
    };

    // Get the offer made by the other peer and set it as the offer description.
    const offerDescription = offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    // Create a new answer for the offer and set it as the local description.
    // So for the caller peer we set the "offer" as the local description and for the remote peer we set the answer as the local description
    const answerDescription = await pc.createAnswer();

    // This also triggers the "onicecandidate" event and sends the remote peers ICE candidates to signaling server which further sends them to the caller
    await pc.setLocalDescription(answerDescription);

    // Create a JS object which contains the SDP answer data
    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    // Send the answer to the signaling server which further sends it to the caller
    channel.push("answer", { answer }, 10000);
    console.log('Push answer from callee', answer);

    // https://stackoverflow.com/questions/38198751/domexception-error-processing-ice-candidate
    caller_candidates.forEach(candidate => {
      console.log('Adding ice candidate', candidate);
      const ice_candidate = new RTCIceCandidate(candidate);
      pc.addIceCandidate(ice_candidate);
    });

    /*
      Setup an event listener to listen for new ice candidates from the caller.
      So when ICE candidates for the callee are received they are added to the
      RTCPeerConnection object for the callee. We had similar logic for the caller as well.
    */
    channel.on("new_ice_candidate", ({ ice_candidate }) => {
      console.log("Receive caller ice candidate", ice_candidate);
      const candidate = new RTCIceCandidate(ice_candidate);
      pc.addIceCandidate(candidate);
    });
  };
});
