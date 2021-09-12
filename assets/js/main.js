import { Socket } from "phoenix";

window.addEventListener('load', () => {

  // Init phoenix socket
  let socket = new Socket("/socket", { params: { test: 123 } });
  let channel;
  socket.connect();

  // Helper function to generate a unique call id
  const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

  // Helper function to await joining the channel
  const join_channel = (channel, call_id) => new Promise((resolve, reject) => {
    channel.join()
      .receive("ok", resp => {
        console.log(`Joined topic call:${call_id} successfully`, resp);
        resolve(resp);
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

  // Free STUN servers avaibale from google
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

    callInput.value = callId; // This is unique auto generated ID of a document from firestore, peer 2 will use this to answer to the offer made by peer 1

    /*
      Get candidates for caller, save to db
  
      Set up an event listener to save ICE candidates from yourself or your local peer
      to firestore db collection "offerCandidates".
  
      An ICE candidate contains a potential IP address and port pair 
      that can be used to establish a peer-2-peer connection.
  
      Your ICE candidates are generated when `pc.setLocalDescription` is called
      so this listener must be setup before calling pc.setLocalDescription
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

    // ---------------------------------------------------

    // Update local RTCPeerConnection with answer from remote peer
    /* 
      Callback to be fired whenever the offer doc that we created in firestore changes.
      Here we are listening for answer to our offer and updating our local RTCPeerConnection object
      with the answer. 
    */
    channel.on("answer", ({ answer }) => {
      console.log("Received Answer", answer);
      const candidate = new RTCIceCandidate(answer);
      pc.addIceCandidate(candidate);
    });

    /*
      We also need to listen for updates to the ICE candidates from the remote peer connection.
      This data is stored in firestore "answerCandidates" doc and we listen for changes on it.
  
      When answered, add remote peers ICE candidate to the local RTCPeerConnection.
    */
    channel.on("ice_candidate", ({ ice_candidate }) => {
      console.log("Received ICE candidate for peer 2", answer);
      const candidate = new RTCIceCandidate(ice_candidate);
      pc.addIceCandidate(candidate);
    });

    hangupButton.disabled = false;
  };

  // -----------------------------------------------------------------------


  // 3. Answer the call with the unique ID, this happens on the remote peer
  answerButton.onclick = async () => {
    const callId = callInput.value;

    // TODO: Fix duplicate channel join
    if (!channel) {
      // Join channels with a topic:
      channel = socket.channel(`call:${callId}`, { type: "callee" });
      const caller_candidates = await join_channel(channel, callId);

      caller_candidates.forEach(candidate => {
        const ice_candidate = new RTCIceCandidate(candidate);
        pc.addIceCandidate(ice_candidate);
      });
    }

    const offer = await new Promise((resolve, reject) => {
      return channel.push("get_offer", {}, 10000)
        .receive("ok", (offer) => resolve(offer))
        .receive("error", reasons => reject(reasons))
        .receive("timeout", () => reject("Networking issue..."));
    });

    console.log("GOT Offer", offer);

    if (!offer) {
      channel.leave();
      alert("Invalid call Id");
      return;
    }

    /*
      Get candidates for this remote peer, and save to db collection "answerCandidates"
  
      An ICE candidate contains a potential IP address and port pair 
      that can be used to establish a peer-2-peer connection.
  
      Your ICE candidates are generated when `pc.setLocalDescription` is called
      so this listener must be setup before calling pc.setLocalDescription
    */
    pc.onicecandidate = (event) => {
      if (event.candidate) channel.push("ice_candidate", { ice_candidate: event.candidat, type: "callee" }, 10000);
    };

    // Get the offer made by the other peer and set it as the offer description.
    const offerDescription = offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    // Create a new answer for the offer and set it as the local description.
    // So for the caller peer we set the "offer" as the local description and for the remote peer we set the answer as the local description
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription); // This also triggers the "onicecandidate" event and saves the remote peers ICE candidates to the "answerCandidates" collection in firestore

    // Create a JS object which contains the SDP answer data that can be saved to firestore db collection "answerCandidates"
    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    // Save the answer to firestore db collection "answerCandidates", 
    // the answer ice candidates are saved via the "onicecandidate" event listener
    channel.push("answer", { answer }, 10000);

    /*
      Setup an event listener to listen for changes in the "offerCandidates" collection.
      So when ICE candidates for the caller/peer 1 are added they can be updated in remote/peer 2's
      RTCPeerConnection object. We had similar thing for caller as well.
    */
    channel.on("new_ice_candidate", ({ ice_candidate }) => {
      console.log("Receive peer 1 ice candidate", ice_candidate);
      const candidate = new RTCIceCandidate(ice_candidate);
      pc.addIceCandidate(candidate);
    });
  };
});
