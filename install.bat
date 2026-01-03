@echo off
echo ===============================================
echo       Instalacao do Sistema Data Sistemas
echo ===============================================
echo.

echo 1/4 Instalando dependencias do cliente...
call npm install
if %errorlevel% neq 0 (
    echo Erro durante instalacao das dependencias do cliente!
    pause
    exit /b %errorlevel%
)

echo.
echo 2/4 Instalando dependencias do servidor...
cd server
call npm install
cd ..
if %errorlevel% neq 0 (
    echo Erro durante instalacao das dependencias do servidor!
    pause
    exit /b %errorlevel%
)

echo.
echo 3/4 Instalando tsx globalmente...
call npm install -g tsx
if %errorlevel% neq 0 (
    echo AVISO: Erro ao instalar tsx globalmente.
    echo O sistema usara npx tsx automaticamente.
)

echo.
echo 4/4 Criando arquivo .env...
if not exist ".env.local" (
    copy .env.example .env.local
    echo Arquivo .env.local criado. Configure suas credenciais!
)

echo.
echo ===============================================
echo   Instalacao concluida com sucesso!
echo ===============================================
echo.
echo Proximos passos:
echo   1. Configure o arquivo .env.local com suas credenciais
echo   2. Execute db-push.bat para criar as tabelas no MySQL
echo   3. Execute dev.bat para iniciar o sistema
echo   4. Acesse: http://localhost:5173
echo.
pause
