defmodule SimpleWrtcDemo.Call do
  defstruct(
    offer: nil,
    caller_candidates: [],
    callee_candidates: []
  )

  @type t :: %__MODULE__{
          offer: String.t(),
          caller_candidates: list(String.t()),
          callee_candidates: list(String.t())
        }
end
