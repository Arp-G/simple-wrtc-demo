defmodule SimpleWrtcDemo.CallsStore do
  use GenServer

  alias SimpleWrtcDemo.Call

  ## Public API
  def get_offer(id) do
    GenServer.call(__MODULE__, {:get_offer, id})
  end

  def set_offer(id, offer) do
    GenServer.call(__MODULE__, {:set_offer, {id, offer}})
  end

  def get_candidates(id) do
    GenServer.call(__MODULE__, {:get_candidates, id})
  end

  def set_candidate(id, candidate) do
    GenServer.cast(__MODULE__, {:set_candidate, {id, candidate}})
  end

  ## Server Implemention
  def start_link(_opts) do
    GenServer.start_link(__MODULE__, nil, name: __MODULE__)
  end

  def init(_args) do
    {:ok, %{}}
  end

  def handle_call({:get_candidates, id}, _from, state) do
    candidates =
      case Map.get(state, id) do
        %Call{candidates: candidates} -> candidates
        _ -> []
      end

    {:reply, candidates, state}
  end

  def handle_call({:get_offer, id}, _from, state) do
    call = Map.get(state, id)
    offer = if call, do: call.offer, else: nil
    {:reply, offer, state}
  end

  def handle_call({:set_offer, {id, offer}}, _from, state) do
    {:reply, id, Map.put(state, id, %Call{offer: offer})}
  end

  def handle_cast({:set_candidate, {id, candidate}}, state) do
    state =
      case Map.get(state, id) do
        %Call{candidates: candidates} = call ->
          updated_call = %{call | candidates: [candidate | candidates]}
          Map.put(state, id, updated_call)

        _ ->
          state
      end

    {:noreply, state}
  end

  def handle_cast({:set_candidate, _}, state), do: {:noreply, state}
end
