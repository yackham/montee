#!/bin/bash
# $1 = dossier de sortie
cd "$(dirname "$0")"
printf "%s\n" lin nuit terre dur gazon indoor moquette nocturne retro vert crep | xargs -P 4 -I{} sh -c "timeout 1200 node cap.js {} $1/{} > $1.{}.log 2>&1"
