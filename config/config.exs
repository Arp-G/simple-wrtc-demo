# This file is responsible for configuring your application
# and its dependencies with the aid of the Mix.Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
use Mix.Config

# Configures the endpoint
config :simple_wrtc_demo, SimpleWrtcDemoWeb.Endpoint,
  url: [host: "localhost"],
  secret_key_base: "Ls7By0xIMCy3mxHoi2x90y+wdKQNXVARRvDTkLBikBLIhgEsI1HWMfv6e2hPfiFe",
  render_errors: [view: SimpleWrtcDemoWeb.ErrorView, accepts: ~w(html json), layout: false],
  pubsub_server: SimpleWrtcDemo.PubSub,
  live_view: [signing_salt: "vPF2RKTT"]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{Mix.env()}.exs"
