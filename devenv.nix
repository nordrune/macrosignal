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
  qaWeb = "${webRun} qa";
  webBuild = "${webRun} build";
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
    exec = "cd ${webDir} && bun --bun run dev --port \"$WEB_PORT\" --host \"$HOST\"";
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
    # Manual aliases, not part of devenv test (individual qa:web:* tasks already run)
    "qa:web" = {
      exec = qaWeb;
      after = [ "qa:web:typecheck" ];
    };
    "build:web" = {
      exec = webBuild;
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
        curl -sf http://127.0.0.1:${toString webPort}/ | grep -q "github.com/nordrune/macrosignal"
      '';
      after = [
        "qa:pytest"
        "devenv:processes:api@ready"
        "devenv:processes:web@ready"
      ];
      before = [ "devenv:enterTest" ];
    };
  };

  enterShell = ''
    echo "MacroSignal API:  http://127.0.0.1:${toString apiPort}  (API_ORIGIN)"
    echo "MacroSignal Web:  http://127.0.0.1:${toString webPort}  (devenv up)"
    echo ""
    echo "  devenv up                  # api + web dev processes"
    echo "  devenv up api              # API only"
    echo "  devenv up web              # SvelteKit only (needs API running)"
    echo "  ENV=prod devenv up api     # production-style API (no reload)"
    echo "  devenv test                # full QA (kill devenv up first; port ${toString apiPort})"
    echo "  devenv tasks run qa:web    # web oxfmt + oxlint + svelte-check"
    echo "  devenv tasks run build:web # production web build"
    echo "  git push runs devenv test (pre-push hook)"
  '';
}