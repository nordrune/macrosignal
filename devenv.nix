{ pkgs, lib, config, ... }:

let
  apiPort = 41793;
  webPort = 5173;
  hasWeb = builtins.pathExists ./web/package.json;
  uvRun = "env -u VIRTUAL_ENV uv run";
  qaFormat = "${uvRun} ruff format .";
  qaLint = "${uvRun} ruff check .";
  qaTypecheck = "${uvRun} ty check";
  qaPytest = "${uvRun} pytest";
  isTesting = config.devenv.isTesting;
  prodScript = "./scripts/prod.sh";
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
    pkgs.cacert
    pkgs.curl
    pkgs.tokei
  ] ++ lib.optionals hasWeb [ pkgs.bun ];

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

  languages.javascript = lib.mkIf hasWeb {
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
    PORT = toString webPort;
    BUN_TMPDIR = "/tmp/bun-macrosignal";
    ENV = lib.mkDefault "dev";
  };

  processes.api = {
    exec = "${prodScript} api \"\${ENV:-dev}\"";
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
    exec = "${prodScript} web \"\${ENV:-dev}\"";
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
    tokei-stats = {
      enable = true;
      name = "tokei stats";
      entry = "scripts/update-tokei.sh";
      language = "system";
      pass_filenames = false;
      always_run = true;
      stages = [ "pre-commit" ];
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
    "qa:web:format" = lib.mkIf hasWeb {
      exec = qaWebFormat;
      before = [ "devenv:enterTest" ];
    };
    "qa:web:lint" = lib.mkIf hasWeb {
      exec = qaWebLint;
      after = [ "qa:web:format" ];
      before = [ "devenv:enterTest" ];
    };
    "qa:web:typecheck" = lib.mkIf hasWeb {
      exec = qaWebTypecheck;
      after = [ "qa:web:lint" ];
      before = [ "devenv:enterTest" ];
    };
    "qa:web" = lib.mkIf hasWeb {
      exec = qaWeb;
      after = [ "qa:web:typecheck" ];
    };
    "build:web" = lib.mkIf hasWeb {
      exec = webBuild;
    };
    "qa:pytest" = {
      exec = qaPytest;
      after =
        [ "qa:typecheck" ]
        ++ lib.optionals hasWeb [ "qa:web:typecheck" ];
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
    echo "MacroSignal public: http://127.0.0.1:${toString webPort}"
    echo "MacroSignal API:    http://127.0.0.1:${toString apiPort}  (main layout only)"
    echo ""
    echo "  devenv up                  # api + web dev processes"
    echo "  devenv up api              # API only (main layout)"
    echo "  devenv up web              # public entry (SvelteKit or checkpoint uvicorn)"
    echo "  ./scripts/prod.sh api prod # production API (systemd)"
    echo "  ./scripts/prod.sh web prod # production web (systemd)"
    echo "  devenv test                # full QA (main layout; port ${toString apiPort})"
    echo "  devenv tasks run qa:web    # web oxfmt + oxlint + svelte-check"
    echo "  devenv tasks run build:web # production web build"
    echo "  git push runs devenv test (pre-push hook)"
  '';
}