defmodule SimpleWrtcDemo.CallsStore do
  use GenServer

  alias SimpleWrtcDemo.Call

  ## Public API
  def get_offer(id) do
    GenServer.call(__MODULE__, {:get, id})
  end

  def create_offer(id, offer) do
    GenServer.call(__MODULE__, {:set, {id, offer}})
  end

  def save_candidate(id, type, candidate) do
    GenServer.cast(__MODULE__, {:save_candidate, {id, candidate, type}})
  end

  def get_candidates(id) do
    GenServer.call(__MODULE__, {:get_candidates, id})
  end

  ## Server Implemention
  def start_link(_opts) do
    GenServer.start_link(__MODULE__, nil, name: __MODULE__)
  end

  def init(_args) do
    {:ok, %{}}
  end

  def handle_call({:get_candidates, id}, _from, state) do
    caller_candidates =
      case Map.get(state, id) do
        %Call{caller_candidates: caller_candidates} -> caller_candidates
        _ -> nil
      end

    {:reply, caller_candidates, state}
  end

  def handle_call({:set, {id, offer}}, _from, state) do
    {:reply, id, Map.put(state, id, %Call{offer: offer})}
  end

  def handle_call({:get, id}, _from, state) do
    {:reply, Map.get(state, id).offer, state}
  end

  def handle_cast({:save_candidate, {id, type, candidate}}, state)
      when type in ["caller", "callee"] do
    state =
      case Map.get(state, id) do
        %Call{caller_candidates: caller_candidates, callee_candidates: callee_candidates} = call ->
          updated_call =
            case type do
              "caller" -> %{call | caller_candidates: [candidate | caller_candidates]}
              "callee" -> %{call | callee_candidates: [candidate | callee_candidates]}
            end

          Map.put(state, id, updated_call)

        _ ->
          state
      end

    {:noreply, state}
  end

  def handle_cast({:save_candidate, _}, state), do: {:noreply, state}
end
