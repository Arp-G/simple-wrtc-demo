defmodule SimpleWrtcDemoWeb.PageController do
  use SimpleWrtcDemoWeb, :controller

  def index(conn, _params) do
    render(conn, "index.html")
  end
end
