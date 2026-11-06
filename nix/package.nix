{ pkgs, src, settings ? { }, upstreamSettings ? { } }:
let
  configuration = pkgs.writeText "twitter-personal-config.json" (builtins.toJSON {
    inherit settings upstreamSettings;
  });
in
pkgs.runCommand "twitter-personal" { nativeBuildInputs = [ pkgs.nodejs ]; } ''
  cd ${src}
  node --test personal/tests/*.test.mjs
  node personal/scripts/build.mjs "$out" ${configuration}
  for script in "$out"/*.js "$out"/personal/*.js; do
    node --check "$script"
  done
''
