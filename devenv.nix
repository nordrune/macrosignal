{ pkgs, lib, config, ... }:

let
  appPort = 41793;
  uvRun = "env -u VIRTUAL_ENV uv run";
  qaFormat = "${uvRun} ruff format .";
  qaLint = "${uvRun} ruff check .";
  qaTypecheck = "${uvRun} ty check";
  qaPytest = "${uvRun} pytest";
  isTesting = config.devenv.isTesting;
  uvicornApp = ''
    ${uvRun} uvicorn trading_backtester.api:app \
      --host "$HOST" \
      --port "$PORT" \
      --log-level info
  '';
in
{
  name = "macrosignal";

  delta.enable = true;

  packages = [
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

  env = {
    HOST = "127.0.0.1";
    PORT = toString appPort;
    ENV = lib.mkDefault "dev";
  };

  processes.app = {
    exec = ''
      if [ "$ENV" = prod ]; then
        ${uvicornApp} --workers 1
      else
        ${uvicornApp} \
          ${lib.optionalString (!isTesting) "--reload"}
      fi
    '';
    ready = {
      http.get = {
        host = "127.0.0.1";
        port = appPort;
        path = "/";
      };
      initial_delay = 2;
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
    "qa:pytest" = {
      exec = qaPytest;
      after = [ "qa:typecheck" ];
      before = [ "devenv:enterTest" ];
    };
    "qa:smoke" = {
      exec = ''
        curl -sf http://127.0.0.1:${toString appPort}/ | grep -qi "MacroSignal"
        curl -sf -X POST http://127.0.0.1:${toString appPort}/api/backtest \
          -H "Content-Type: application/json" \
          -d @tests/fixtures/smoke_backtest_request.json \
          | grep -q "end_capital"
      '';
      after = [
        "qa:pytest"
        "devenv:processes:app@ready"
      ];
      before = [ "devenv:enterTest" ];
    };
  };

  enterShell = ''
    echo "MacroSignal ready: http://127.0.0.1:${toString appPort}"
    echo "  devenv up            # ENV=dev (default)"
    echo "  ENV=prod devenv up   # production-style"
    echo "  devenv test"
    echo "  devenv tasks run qa:lint"
    echo "  git push runs devenv test (full QA gate)"
  '';
}