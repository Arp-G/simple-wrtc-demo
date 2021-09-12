defmodule SimpleWrtcDemo.Stores.AnswersStore do
  @moduledoc """
    Stores the webRTC answer sdp data
  """
  use GenServer

  # ETS table name
  @table_name :answers

  # == Public API ==
  def get_answer(answer_id) do
    GenServer.answer(__MODULE__, {:get, answer_id})
  end

  def create_answer(answer) do
    GenServer.answer(__MODULE__, {:set, answer})
  end

  # == GenServer answerbacks ==
  def start_link(_opts) do
    GenServer.start_link(__MODULE__, nil, name: __MODULE__)
  end

  def init(_args) do
    :ets.new(@table_name, [:named_table, :set, :private])

    {:ok, nil}
  end

  def handle_answer({:get, answer_id}, _from, state) do
    answer = :ets.lookup(@table_name, answer_id)
    {:reply, answer, state}
  end

  def handle_answer({:set, answer}, _from, state) do
    answer_id = Nanoid.generate()
    true = :ets.insert(@table_name, {answer_id, answer})
    {:reply, answer_id, state}
  end
end
