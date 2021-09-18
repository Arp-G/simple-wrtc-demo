defmodule SimpleWrtcDemo.Call do
  defstruct(
    offer: nil,
    candidates: []
  )

  @type t :: %__MODULE__{
          offer: String.t(),
          candidates: list(String.t())
        }
end
