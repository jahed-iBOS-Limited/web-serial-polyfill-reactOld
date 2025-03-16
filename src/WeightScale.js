import React, { useEffect, useMemo, useState } from 'react';
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
  const [selectedBusinessUnit] = useState({
    value: 0,
    label: '',
  });

  const [weight, setWeight] = useState(0);

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
      let port = await serial.requestPort({});
      setConnectedPort(port);
      return port;
    } catch (error) {}
  };

  const connectHandler = async () => {
    closePort();
    const oldMachineOptions = {
      baudRate: [magnumSteelUnitId, isPatUnitId].includes(
        selectedBusinessUnit?.value,
      )
        ? 9600
        : 1200,
      baudrate: [magnumSteelUnitId, isPatUnitId].includes(
        selectedBusinessUnit?.value,
      )
        ? 9600
        : 1200,
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

    let port = await getSelectedPort();
    if (!port) {
      return;
    }
    let info = port?.getInfo();
    console.log(info, 'info');
    try {
      await port.open(
        isOldMachine(info) ? oldMachineOptions : newMachineOptions,
      );
    } catch (error) {}
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
            let info = port?.getInfo();
            if (isOldMachine(info)) {
              // old machine
              let newValue = decoder.decode(value);
              weightValue += newValue;
              let replacedValue = weightValue.replace(/[^ -~]+/g, ''); // remove stx string
              let splittedValue = replacedValue.split(' ');
              console.log('old machine running', splittedValue);

              splittedValue?.length > 0 &&
                splittedValue.forEach((item) => {
                  if (item?.length === 7 && item?.[0] === '+') {
                    let newValue = item.substring(1, 7);
                    setWeight(Number(newValue));
                  }
                });
            } else {
              // new machine
              let newValue = decoder.decode(value);
              let replacedValue = newValue.replace(/[^ -~]+/g, ''); // remove stx string

              if (
                selectedBusinessUnit?.value === essentialUnitId ||
                selectedBusinessUnit?.value === kofilRazzakUnitId ||
                selectedBusinessUnit?.value === magnumSteelUnitId ||
                selectedBusinessUnit.value === isPatUnitId
              ) {
                let newReplacedValue = replacedValue.replace(/[a-zA-Z]/, '8');
                let replacedValueNumber = Number(newReplacedValue);
                let actualValue = replacedValueNumber / 1000;
                console.log('new machine running', actualValue);
                if (actualValue > 0) {
                  setWeight(actualValue.toFixed());
                }
              } else {
                let splittedValue = replacedValue.split(' ');
                console.log('new machine running', splittedValue);
                splittedValue?.length > 0 &&
                  splittedValue.forEach((item) => {
                    if (item?.length === 5) {
                      setWeight(Number(item));
                    }
                  });
              }
            }
          }
          if (done) {
            break;
          }
        }
      } catch (error) {
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
    console.log('Enter handler calling');
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
    let info = connectedPort?.getInfo();
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
        setConnectedPort(null);
      }
    } catch (error) {}
  };

  useEffect(() => {
    closePort();
  }, []);

  const connectedPortInfo = useMemo(() => {
    if (connectedPort?.getInfo) {
      return connectedPort?.getInfo();
    } else {
      return null;
    }
  }, [connectedPort]);

  console.log('connectedPortInfo', connectedPortInfo);

  const portTitleHandler = () => {
    let isOldMachineValue = isOldMachine(connectedPortInfo);
    if (
      selectedBusinessUnit?.value === magnumSteelUnitId ||
      selectedBusinessUnit.value === isPatUnitId
    ) {
      if (isOldMachineValue) {
        return 'ORION';
      } else {
        return 'SARTORIUS';
      }
    } else {
      if (isOldMachineValue) {
        return 'SCALE-1';
      } else {
        return 'SCALE-2';
      }
    }
  };
  return (
    <div>
      <h1>Weight Scale</h1>
      <h2>{portTitleHandler()}</h2>
      <h3>{weight}</h3>
      <button onClick={connectHandler}>Connect</button>
      <button onClick={closePort}>Disconnect</button>
    </div>
  );
};

export default WeightScale;
