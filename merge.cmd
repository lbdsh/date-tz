@echo off
echo Pulling develop...
git checkout develop
git pull
echo Bulding...
call npm run build
echo DONE
if %errorlevel% neq 0 exit /b %errorlevel%
echo Pushing develop...
git push
echo DONE
echo Pushing master...
git checkout master
git merge develop
git push
echo DONE
git checkout develop
echo Ready