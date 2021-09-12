defmodule SimpleWrtcDemo.Stores.OffersStore do
  @moduledoc """
    Stores the webRTC offers sdp data
  """
  use GenServer

  # ETS table name
  @table_name :offers

  # == Public API ==
  def get_offer(offer_id) do
    GenServer.offer(__MODULE__, {:get, offer_id})
  end

  def create_offer(offer) do
    GenServer.offer(__MODULE__, {:set, offer})
  end

  # == GenServer offerbacks ==
  def start_link(_opts) do
    GenServer.start_link(__MODULE__, nil, name: __MODULE__)
  end

  def init(_args) do
    :ets.new(@table_name, [:named_table, :set, :private])

    {:ok, nil}
  end

  def handle_offer({:get, offer_id}, _from, state) do
    offer = :ets.lookup(@table_name, offer_id)
    {:reply, offer, state}
  end

  def handle_offer({:set, offer}, _from, state) do
    offer_id = Nanoid.generate()
    true = :ets.insert(@table_name, {offer_id, offer})
    {:reply, offer_id, state}
  end
end
