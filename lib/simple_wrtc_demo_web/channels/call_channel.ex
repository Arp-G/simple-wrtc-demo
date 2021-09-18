# Phoenix channel to be used for signaling
defmodule SimpleWrtcDemoWeb.CallChannel do
  use Phoenix.Channel
  require Logger
  alias SimpleWrtcDemo.CallsStore

  # Caller join
  def join("call:" <> id, %{"type" => "caller"}, socket) do
    Logger.info("Caller join channel: call:#{id}")
    {:ok, assign(socket, :id, id)}
  end

  # Callee join
  def join("call:" <> id, %{"type" => "callee"}, socket) do
    Logger.info("Callee join channel: call#{id}")

    # When callee joins forward ice candidates from the caller
    {:ok, CallsStore.get_candidates(id), assign(socket, :id, id)}
  end

  # Used by callee to fetch the offer made by the caller
  def handle_in("get_offer", _args, socket) do
    {:reply, {:ok, CallsStore.get_offer(socket.assigns.id)}, socket}
  end

  # Used by the caller to store its offer
  # This offer will be later fetched by the callee
  def handle_in("offer", %{"offer" => offer}, socket) do
    CallsStore.set_offer(socket.assigns.id, offer)

    {:noreply, socket}
  end

  # Used by callee to answer to an offer made by the caller
  def handle_in("answer", %{"answer" => answer}, socket) do
    broadcast_from(socket, "answer", %{answer: answer})

    {:noreply, socket}
  end

  # Used by callee to send its ice candidates, since the caller must be already connected to the channel at this point
  # so we don't need to store the callee's candidates and can directly broadcast them to the caller
  def handle_in("ice_candidate", %{"ice_candidate" => ice_candidate, "type" => "callee"}, socket) do
    broadcast_from(socket, "ice_candidate", %{ice_candidate: ice_candidate})
    {:noreply, socket}
  end

  # Used by caller to send ice candidates, since the callee might not be present in the channel so
  # we store the candidates and also broadcast them
  def handle_in("ice_candidate", %{"ice_candidate" => ice_candidate, "type" => "caller"}, socket) do
    CallsStore.set_candidate(socket.assigns.id, ice_candidate)
    broadcast_from(socket, "ice_candidate", %{ice_candidate: ice_candidate})
    {:noreply, socket}
  end
end
