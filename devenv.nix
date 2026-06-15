{ pkgs, lib, config, ... }:

let
  apiPort = 41793;
  webPort = 5173;
  uvRun = "env -u VIRTUAL_ENV uv run";
  qaFormat = "${uvRun} ruff format .";
  qaLint = "${uvRun} ruff check .";
  qaTypecheck = "${uvRun} ty check";
  qaPytest = "${uvRun} pytest";
  isTesting = config.devenv.isTesting;
  litestarApp = ''
    ${uvRun} litestar --app trading_backtester.api:app run \
      --host "$HOST" \
      --port "$API_PORT"
  '';
  webDir = "web";
  webRun = "cd ${webDir} && bun run";
  qaWebFormat = "${webRun} format";
  qaWebLint = "${webRun} lint";
  qaWebTypecheck = "${webRun} typecheck";
in
{
  name = "macrosignal";

  delta.enable = true;

  packages = [
    pkgs.bun
    pkgs.cacert
    pkgs.curl
  ];

  languages.python = {
    enable = true;
    package = pkgs.python312;
    venv.enable = true;
    uv = {
      enable = true;
      sync = {
        enable = true;
        allGroups = true;
      };
    };
  };

  languages.javascript = {
    enable = true;
    directory = webDir;
    bun = {
      enable = true;
      install.enable = true;
    };
  };

  env = {
    HOST = "127.0.0.1";
    API_PORT = toString apiPort;
    WEB_PORT = toString webPort;
    API_ORIGIN = "http://127.0.0.1:${toString apiPort}";
    PORT = toString apiPort;
    ENV = lib.mkDefault "dev";
  };

  processes.api = {
    exec = ''
      if [ "$ENV" = prod ]; then
        ${litestarApp}
      else
        ${litestarApp} \
          ${lib.optionalString (!isTesting) "--reload"}
      fi
    '';
    ready = {
      http.get = {
        host = "127.0.0.1";
        port = apiPort;
        path = "/health";
      };
      initial_delay = 2;
    };
    restart.on = "on_failure";
  };

  processes.web = {
    exec = "cd ${webDir} && bun --bun run dev --port $WEB_PORT";
    ready = {
      http.get = {
        host = "127.0.0.1";
        port = webPort;
        path = "/";
      };
      initial_delay = 3;
    };
    restart.on = "on_failure";
  };

  git-hooks.hooks = {
    "devenv-test" = {
      enable = true;
      name = "devenv test";
      entry = "devenv test --no-tui";
      language = "system";
      pass_filenames = false;
      stages = [ "pre-push" ];
    };
  };

  tasks = {
    "qa:format" = {
      exec = qaFormat;
      before = [ "devenv:enterTest" ];
    };
    "qa:lint" = {
      exec = qaLint;
      after = [ "qa:format" ];
      before = [ "devenv:enterTest" ];
    };
    "qa:typecheck" = {
      exec = qaTypecheck;
      after = [ "qa:lint" ];
      before = [ "devenv:enterTest" ];
    };
    "qa:web:format" = {
      exec = qaWebFormat;
      before = [ "devenv:enterTest" ];
    };
    "qa:web:lint" = {
      exec = qaWebLint;
      after = [ "qa:web:format" ];
      before = [ "devenv:enterTest" ];
    };
    "qa:web:typecheck" = {
      exec = qaWebTypecheck;
      after = [ "qa:web:lint" ];
      before = [ "devenv:enterTest" ];
    };
    "qa:pytest" = {
      exec = qaPytest;
      after = [ "qa:typecheck" "qa:web:typecheck" ];
      before = [ "devenv:enterTest" ];
    };
    "qa:smoke" = {
      exec = ''
        curl -sf -X POST http://127.0.0.1:${toString apiPort}/api/backtest \
          -H "Content-Type: application/json" \
          -d @tests/fixtures/smoke_backtest_request.json \
          | grep -q "end_capital"
      '';
      after = [
        "qa:pytest"
        "devenv:processes:api@ready"
      ];
      before = [ "devenv:enterTest" ];
    };
  };

  enterShell = ''
    echo "MacroSignal API:  http://127.0.0.1:${toString apiPort}"
    echo "MacroSignal Web:  http://127.0.0.1:${toString webPort}  (devenv up)"
    echo "  devenv up            # API + SvelteKit dev"
    echo "  ENV=prod devenv up   # production-style API"
    echo "  devenv test"
    echo "  cd web && bun run qa  # oxfmt + oxlint + svelte-check"
    echo "  git push runs devenv test (full QA gate)"
  '';
}