# RPi-Speedo
Raspberry Pi speedometer based on Electron


install Node.js on Raspberry Pi 3B+

wget https://nodejs.org/download/release/v11.15.0/node-v11.15.0-linux-armv6l.tar.gz

tar -xzf node-v11.15.0-linux-armv6l.tar.gz

cd node-v11.15.0-linux-armv6l/

sudo cp -R * /usr/local/

node -v

npm -v

sudo npm install -g node-modules

sudo npm install -g electron --unsafe-perm=true --allow-root
