@echo off
title Agente de bancada - ConsertosPro
cd /d "%~dp0"
:loop
node agent.mjs
echo O agente parou. Reiniciando em 10 segundos (feche esta janela para encerrar)...
timeout /t 10 /nobreak >nul
goto loop
