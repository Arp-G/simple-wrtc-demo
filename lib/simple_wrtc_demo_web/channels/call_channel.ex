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
    {:ok, CallsStore.get_candidates(id), assign(socket, :id, id)}
  end

  def handle_in("get_offer", _args, socket) do
    {:reply, {:ok, CallsStore.get_offer(socket.assigns.id)}, socket}
  end

  def handle_in("offer", %{"offer" => offer}, socket) do
    CallsStore.create_offer(socket.assigns.id, offer)

    {:noreply, socket}
  end

  def handle_in("answer", %{"answer" => answer}, socket) do
    broadcast_from(socket, "new_answer", %{answer: answer})

    {:noreply, socket}
  end

  def handle_in("ice_candidate", %{"ice_candidate" => ice_candidate, "type" => "callee"}, socket) do
    broadcast_from(socket, "new_ice_candidate", %{ice_candidate: ice_candidate})
    {:noreply, socket}
  end

  def handle_in("ice_candidate", %{"ice_candidate" => ice_candidate, "type" => "caller"}, socket) do
    CallsStore.save_candidate(socket.assigns.id, ice_candidate, "caller")
    {:noreply, socket}
  end
end
