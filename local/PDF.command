#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if [ ! -x "runtime/bin/node" ]; then
  echo "Extrae todo el ZIP de PDF antes de abrir PDF.command."
  read -r -p "Pulsa Intro para cerrar."
  exit 1
fi
exec ./runtime/bin/node ./server.mjs
