@echo off
echo ===============================================
echo       Criando Tabelas no MySQL
echo ===============================================
echo.

echo Este script ira executar o arquivo docs/mysql-migration.sql
echo no seu banco de dados MySQL.
echo.
echo Certifique-se de que:
echo   1. O MySQL esta rodando
echo   2. O banco 'data_sistemas' existe
echo   3. As credenciais no .env.local estao corretas
echo.

set /p DB_USER=Usuario MySQL [root]: 
if "%DB_USER%"=="" set DB_USER=root

set /p DB_PASS=Senha MySQL: 
set /p DB_NAME=Nome do banco [data_sistemas]: 
if "%DB_NAME%"=="" set DB_NAME=data_sistemas

echo.
echo Executando migration...
mysql -u %DB_USER% -p%DB_PASS% %DB_NAME% < docs/mysql-migration.sql

if %errorlevel% neq 0 (
    echo.
    echo ERRO: Falha ao executar migration!
    echo Verifique suas credenciais e tente novamente.
    pause
    exit /b %errorlevel%
)

echo.
echo ===============================================
echo   Tabelas criadas com sucesso!
echo ===============================================
echo.
pause
