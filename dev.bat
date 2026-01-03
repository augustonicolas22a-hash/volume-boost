@echo off
echo ===============================================
echo       Iniciando Sistema Data Sistemas
echo ===============================================
echo.

echo Iniciando servidor backend...
start "Backend" cmd /k "cd server && npm run dev"

echo Aguardando servidor iniciar...
timeout /t 3 /nobreak > nul

echo Iniciando cliente frontend...
start "Frontend" cmd /k "npm run dev"

echo.
echo ===============================================
echo   Sistema iniciado!
echo ===============================================
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3001
echo.
echo   Pressione qualquer tecla para fechar esta janela.
echo   As outras janelas continuarao rodando.
echo.
pause
