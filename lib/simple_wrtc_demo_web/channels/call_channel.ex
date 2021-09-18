# TODO:

# Store ICE candidates of peer 1 and peer 2 separately in db
# When peer 2 answers push peer 1's ice candidates to peer 2

defmodule SimpleWrtcDemoWeb.CallChannel do
  use Phoenix.Channel
  require Logger
  alias SimpleWrtcDemo.CallsStore

  def join("call:" <> id, %{"type" => "caller"}, socket) do
    Logger.info("Caller Join call #{id}")
    {:ok, assign(socket, :id, id)}
  end

  def join("call:" <> id, %{"type" => "callee"}, socket) do
    Logger.info("Callee Join call #{id}")

    # When callee joins forward any existing ice candidates the caller might have send
    {:ok, CallsStore.get_candidates(id), assign(socket, :id, id)}
  end

  # Used by callee to fetch the offer made by the caller
  def handle_in("get_offer", _args, socket) do
    {:reply, {:ok, CallsStore.get_offer(socket.assigns.id)}, socket}
  end

  # Used by caller to create an offer and store it in the signaling server
  # This offer will be later fetched by the callee
  def handle_in("offer", %{"offer" => offer}, socket) do
    CallsStore.create_offer(socket.assigns.id, offer)

    {:noreply, socket}
  end

  # Used by callee to answer to a offer made by the caller
  def handle_in("answer", %{"answer" => answer}, socket) do
    broadcast_from(socket, "answer", %{answer: answer})

    {:noreply, socket}
  end

  # Used by callee to send ice candidates, since the caller must be already connected to the channel
  # before the callee we don't need to store the candidates and can directly broadcast them to the caller
  def handle_in("ice_candidate", %{"ice_candidate" => ice_candidate, "type" => "callee"}, socket) do
    broadcast_from(socket, "new_ice_candidate", %{ice_candidate: ice_candidate})
    {:noreply, socket}
  end

  # Used by caller to send ice candidates, since the callee might not be present in the channel so
  # we store the candidates which can be later fetched by the callee
  def handle_in("ice_candidate", %{"ice_candidate" => ice_candidate, "type" => "caller"}, socket) do
    CallsStore.save_candidate(socket.assigns.id, ice_candidate, "caller")
    broadcast_from(socket, "new_ice_candidate", %{ice_candidate: ice_candidate})
    {:noreply, socket}
  end
end
