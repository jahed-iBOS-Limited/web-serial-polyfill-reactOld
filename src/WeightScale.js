import React from 'react';
import { useEffect, useState } from 'react';
import { serial as polyfill } from 'web-serial-polyfill';

const magnumSteelUnitId = 171;
const isPatUnitId = 224;
const essentialUnitId = 144;
const kofilRazzakUnitId = 189;

const urlParams = new URLSearchParams(window.location.search);
const usePolyfill = urlParams.has('polyfill');
let weightValue = '';
let reader = null;
let writer = null;

const WeightScale = () => {
  const [connectedPort, setConnectedPort] = useState(null);
  const [weight, setWeight] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const isOldMachine = (info) => {
    if (info?.usbProductId === 9123 && info?.usbVendorId === 1659) {
      return true;
    } else {
      return false;
    }
  };

  const getSelectedPort = async () => {
    try {
      const serial = usePolyfill ? polyfill : navigator.serial;
      console.log(serial, 'serial');
      console.log(navigator.serial, 'navigator.serial');
      console.log(polyfill, 'polyfill');
      const port = await serial.requestPort({});
      console.log(port, 'port');
      setConnectedPort(port);
      return port;
    } catch (error) {
      console.log(error, 'error in getting port');
    }
  };

  const connectHandler = async () => {
    closePort();
    const oldMachineOptions = {
      baudRate: 1200,
      baudrate: 1200,
      bufferSize: 8192,
      dataBits: 7,
      databits: 7,
      flowControl: 'none',
      parity: 'even',
      rtscts: false,
      stopBits: 1,
      stopbits: 1,
    };

    const newMachineOptions = {
      baudRate: 9600,
      baudrate: 9600,
      bufferSize: 8192,
      dataBits: 7,
      databits: 7,
      flowControl: 'none',
      parity: 'even',
      rtscts: false,
      stopBits: 1,
      stopbits: 1,
    };

    const port = await getSelectedPort();
    if (!port) {
      return;
    }
    const info = port?.getInfo();
    console.log(info, 'info');
    try {
      await port.open(
        isOldMachine(info) ? oldMachineOptions : newMachineOptions,
      );
      setIsConnected(true);
    } catch (error) {
      console.log(error, 'error in opening port');
    }
    while (port && port.readable) {
      reader = port?.readable?.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            reader.releaseLock();
            break;
          }
          if (value) {
            const info = port?.getInfo();
            if (isOldMachine(info)) {
              // old machine
              const newValue = decoder.decode(value);
              weightValue += newValue;
              const replacedValue = weightValue.replace(/[^ -~]+/g, ''); // remove stx string
              const splittedValue = replacedValue.split(' ');
              console.log('old machine running', splittedValue);

              splittedValue?.length > 0 &&
                splittedValue.forEach((item) => {
                  if (item?.length === 7 && item?.[0] === '+') {
                    const newValue = item.substring(1, 7);
                    setWeight(Number(newValue));
                  }
                });
            } else {
              // new machine
              const newValue = decoder.decode(value);
              const replacedValue = newValue.replace(/[^ -~]+/g, ''); // remove stx string

              const newReplacedValue = replacedValue.replace(/[a-zA-Z]/, '8');
              const replacedValueNumber = Number(newReplacedValue);
              const actualValue = replacedValueNumber / 1000;
              console.log('new machine running', actualValue);
              if (actualValue > 0) {
                setWeight(actualValue.toFixed());
              }
            }
          }
          if (done) {
            break;
          }
        }
      } catch (error) {
        console.log(error, 'error in reading');
        closePort();
      } finally {
        if (reader) {
          reader.releaseLock();
          reader = undefined;
        }
      }
    }
  };

  const enterHandler = () => {
    console.log(connectedPort, 'connectedPort');
    weightValue = '';
    if (connectedPort?.writable == null) {
      console.warn(`unable to find writable port`);
      return;
    }
    writer = connectedPort.writable.getWriter();
    writer.write(encoder.encode('test'));
    writer.releaseLock();
  };

  useEffect(() => {
    const info = connectedPort?.getInfo();
    let interval = null;
    if (isOldMachine(info)) {
      interval = setInterval(() => {
        if (connectedPort) {
          enterHandler();
        }
      }, 250);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  });

  const closePort = async () => {
    try {
      if (connectedPort) {
        if (reader) {
          reader.releaseLock();
        }
        if (connectedPort) {
          await connectedPort.close();
        }
      }
    } catch (error) {
      console.log(error, 'error in closing port');
    }
  };

  useEffect(() => {
    closePort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="main-weight-scale">
      <div style={{ padding: '20px' }}>
        <h2>Web Serial Polyfill Example</h2>
        <button
          onClick={() => {
            connectHandler();
          }}
          disabled={isConnected}
        >
          {isConnected ? 'Connected' : 'Connect Serial'}
        </button>
        <button
          onClick={(e) => {
            connectHandler();
          }}
          disabled={!isConnected}
        >
          Disconnect
        </button>
        <pre>Received Data: {weight}</pre>
      </div>
    </div>
  );
};

export default WeightScale;
