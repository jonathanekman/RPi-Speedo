import serial
import json

gps = serial.Serial("/dev/ttyUSB0", baudrate = 4800)
firstLine = gps.readline()  #scrap

while True:
    line = gps.readline()
    data = line.decode().split(",")
    if data[0] == "$GPRMC":
        if data[2] == "A":

            mps = (float(data[7]) * 0.51444) 
            # kph = (round((mps * 3.6), 1)) #two decimals
            kph = (int(mps * 3.6))
            # print(round(kph,2))
            speed = {"speed": kph}
            with open('kph.json', 'w') as f:
                json.dump(speed, f)

        else:
            print("Navigation warning!")  