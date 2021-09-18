defmodule SimpleWrtcDemo.StoreSupervisor do
  use Supervisor
  alias SimpleWrtcDemo.CallsStore

  def start_link(_state) do
    Supervisor.start_link(__MODULE__, nil, name: __MODULE__)
  end

  def init(_init_arg) do
    children = [{CallsStore, [:ok]}]

    # Restarts the store in case it crashes
    Supervisor.init(children, strategy: :one_for_one)
  end
end
