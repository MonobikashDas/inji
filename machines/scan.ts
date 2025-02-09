import SmartShare from '@idpass/smartshare-react-native';
import LocationEnabler from 'react-native-location-enabler';
import SystemSetting from 'react-native-system-setting';
import { EventFrom, send, sendParent, StateFrom } from 'xstate';
import { createModel } from 'xstate/lib/model';
import { EmitterSubscription, Linking, PermissionsAndroid } from 'react-native';
import { DeviceInfo } from '../components/DeviceInfoList';
import { Message } from '../shared/Message';
import { getDeviceNameSync } from 'react-native-device-info';
import { VC } from '../types/vc';
import { AppServices } from '../shared/GlobalContext';
import { ActivityLogEvents } from './activityLog';
import { VID_ITEM_STORE_KEY } from '../shared/constants';

const model = createModel(
  {
    serviceRefs: {} as AppServices,
    senderInfo: {} as DeviceInfo,
    receiverInfo: {} as DeviceInfo,
    selectedVid: {} as VC,
    reason: '',
    loggers: [] as EmitterSubscription[],
    locationConfig: {
      priority: LocationEnabler.PRIORITIES.BALANCED_POWER_ACCURACY,
      alwaysShow: false,
      needBle: true,
    },
    vidName: '',
  },
  {
    events: {
      EXCHANGE_DONE: (receiverInfo: DeviceInfo) => ({ receiverInfo }),
      RECEIVE_DEVICE_INFO: (info: DeviceInfo) => ({ info }),
      SELECT_VID: (vid: VC) => ({ vid }),
      SCAN: (params: string) => ({ params }),
      ACCEPT_REQUEST: () => ({}),
      VID_ACCEPTED: () => ({}),
      VID_REJECTED: () => ({}),
      CANCEL: () => ({}),
      DISMISS: () => ({}),
      CONNECTED: () => ({}),
      DISCONNECT: () => ({}),
      SCREEN_BLUR: () => ({}),
      SCREEN_FOCUS: () => ({}),
      UPDATE_REASON: (reason: string) => ({ reason }),
      LOCATION_ENABLED: () => ({}),
      LOCATION_DISABLED: () => ({}),
      FLIGHT_ENABLED: () => ({}),
      FLIGHT_DISABLED: () => ({}),
      FLIGHT_REQUEST: () => ({}),
      LOCATION_REQUEST: () => ({}),
      UPDATE_VID_NAME: (vidName: string) => ({ vidName }),
      STORE_RESPONSE: (response: any) => ({ response }),
      APP_ACTIVE: () => ({}),
    },
  }
);

export const ScanEvents = model.events;

type ExchangeDoneEvent = EventFrom<typeof model, 'EXCHANGE_DONE'>;
type ScanEvent = EventFrom<typeof model, 'SCAN'>;
type SelectVidEvent = EventFrom<typeof model, 'SELECT_VID'>;
type UpdateReasonEvent = EventFrom<typeof model, 'UPDATE_REASON'>;
type ReceiveDeviceInfoEvent = EventFrom<typeof model, 'RECEIVE_DEVICE_INFO'>;

export const scanMachine = model.createMachine(
  {
    id: 'scan',
    context: model.initialContext,
    initial: 'inactive',
    on: {
      SCREEN_BLUR: 'inactive',
      SCREEN_FOCUS: 'checkingAirplaneMode',
    },
    states: {
      inactive: {
        entry: ['removeLoggers'],
      },
      checkingAirplaneMode: {
        invoke: {
          src: 'checkAirplaneMode',
        },
        initial: 'checkingStatus',
        states: {
          checkingStatus: {
            on: {
              FLIGHT_DISABLED: '#checkingLocationService',
              FLIGHT_ENABLED: 'enabled',
            },
          },
          requestingToDisable: {
            entry: ['requestToDisableFlightMode'],
            on: {
              FLIGHT_DISABLED: 'checkingStatus',
            },
          },
          enabled: {
            on: {
              FLIGHT_REQUEST: 'requestingToDisable',
            },
          },
        },
      },
      checkingLocationService: {
        id: 'checkingLocationService',
        invoke: {
          src: 'checkLocationStatus',
        },
        initial: 'checkingStatus',
        states: {
          checkingStatus: {
            on: {
              LOCATION_ENABLED: 'checkingPermission',
              LOCATION_DISABLED: 'requestingToEnable',
            },
          },
          requestingToEnable: {
            entry: ['requestToEnableLocation'],
            on: {
              LOCATION_ENABLED: 'checkingPermission',
              LOCATION_DISABLED: 'disabled',
            },
          },
          checkingPermission: {
            invoke: {
              src: 'checkLocationPermission',
            },
            on: {
              LOCATION_ENABLED: '#clearingConnection',
              LOCATION_DISABLED: 'denied',
            },
          },
          denied: {
            on: {
              LOCATION_REQUEST: {
                actions: ['openSettings'],
              },
              APP_ACTIVE: 'checkingPermission',
            },
          },
          disabled: {
            on: {
              LOCATION_REQUEST: 'requestingToEnable',
            },
          },
        },
      },
      clearingConnection: {
        id: 'clearingConnection',
        entry: ['disconnect'],
        after: {
          250: 'findingConnection',
        },
      },
      findingConnection: {
        id: 'findingConnection',
        entry: ['removeLoggers', 'registerLoggers'],
        on: {
          SCAN: [
            {
              cond: 'isQrValid',
              target: 'preparingToConnect',
              actions: ['setConnectionParams'],
            },
            { target: 'invalid' },
          ],
        },
      },
      preparingToConnect: {
        entry: ['requestSenderInfo'],
        on: {
          RECEIVE_DEVICE_INFO: {
            target: 'connecting',
            actions: ['setSenderInfo'],
          },
        },
      },
      connecting: {
        meta: {
          message: 'Connecting...',
        },
        invoke: {
          src: 'discoverDevice',
        },
        on: {
          CONNECTED: 'exchangingDeviceInfo',
        },
      },
      exchangingDeviceInfo: {
        meta: {
          message: 'Exchanging device info...',
        },
        invoke: {
          src: 'exchangeDeviceInfo',
        },
        on: {
          DISCONNECT: '#scan.disconnected',
          EXCHANGE_DONE: {
            target: 'reviewing',
            actions: ['setReceiverInfo'],
          },
        },
      },
      reviewing: {
        on: {
          CANCEL: 'findingConnection',
          DISMISS: 'findingConnection',
          ACCEPT_REQUEST: '.selectingVid',
          UPDATE_REASON: {
            actions: ['setReason'],
          },
        },
        initial: 'idle',
        states: {
          idle: {
            on: {
              ACCEPT_REQUEST: 'selectingVid',
            },
          },
          selectingVid: {
            on: {
              SELECT_VID: {
                target: 'sendingVid',
                actions: ['setSelectedVid'],
              },
              CANCEL: 'idle',
            },
          },
          sendingVid: {
            invoke: {
              src: 'sendVid',
            },
            on: {
              DISCONNECT: '#scan.disconnected',
              VID_ACCEPTED: 'accepted',
              VID_REJECTED: 'rejected',
            },
          },
          accepted: {
            entry: ['logShared'],
            on: {
              DISMISS: 'navigatingToHome',
            },
          },
          rejected: {},
          cancelled: {},
          navigatingToHome: {},
        },
        exit: ['disconnect', 'clearReason'],
      },
      disconnected: {
        on: {
          DISMISS: 'findingConnection',
        },
      },
      invalid: {
        meta: {
          message: 'Invalid QR Code',
        },
        on: {
          DISMISS: 'findingConnection',
        },
      },
    },
  },
  {
    actions: {
      requestSenderInfo: sendParent('REQUEST_DEVICE_INFO'),

      setSenderInfo: model.assign({
        senderInfo: (_, event: ReceiveDeviceInfoEvent) => event.info,
      }),

      requestToEnableLocation: (context) => {
        LocationEnabler.requestResolutionSettings(context.locationConfig);
      },

      requestToDisableFlightMode: () => {
        SystemSetting.switchAirplane(() => {})
      },

      disconnect: () => {
        try {
          SmartShare.destroyConnection();
        } catch (e) {
          //
        }
      },

      setConnectionParams: (_, event: ScanEvent) => {
        SmartShare.setConnectionParameters(event.params);
      },

      setReceiverInfo: model.assign({
        receiverInfo: (_, event: ExchangeDoneEvent) => event.receiverInfo,
      }),

      setReason: model.assign({
        reason: (_, event: UpdateReasonEvent) => event.reason,
      }),

      clearReason: model.assign({ reason: '' }),

      setSelectedVid: model.assign({
        selectedVid: (context, event: SelectVidEvent) => {
          return {
            ...event.vid,
            reason: context.reason,
          };
        },
      }),

      registerLoggers: model.assign({
        loggers: () => [
          SmartShare.handleNearbyEvents((event) => {
            console.log(
              getDeviceNameSync(),
              '<Sender.Event>',
              JSON.stringify(event)
            );
          }),
          SmartShare.handleLogEvents((event) => {
            console.log(
              getDeviceNameSync(),
              '<Sender.Log>',
              JSON.stringify(event)
            );
          }),
        ],
      }),

      removeLoggers: model.assign({
        loggers: ({ loggers }) => {
          loggers?.forEach((logger) => logger.remove());
          return [];
        },
      }),

      logShared: send(
        (context) =>
          ActivityLogEvents.LOG_ACTIVITY({
            _vidKey: VID_ITEM_STORE_KEY(context.selectedVid),
            action: 'shared',
            timestamp: Date.now(),
            deviceName:
              context.receiverInfo.name || context.receiverInfo.deviceName,
            vidLabel: context.selectedVid.tag || context.selectedVid.id,
          }),
        { to: (context) => context.serviceRefs.activityLog }
      ),

      openSettings: () => {
        Linking.openSettings();
      },
    },

    services: {
      checkLocationPermission: () => async (callback) => {
        try {
          // TODO: a more reliable way to wait for animation to finish when app becomes active
          await new Promise((resolve) => setTimeout(resolve, 250));

          const response = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location access',
              message:
                'Location access is required for the scanning functionality.',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          if (response === 'granted') {
            callback(model.events.LOCATION_ENABLED());
          } else {
            callback(model.events.LOCATION_DISABLED());
          }
        } catch (e) {
          console.error(e);
        }
      },

      checkLocationStatus: (context) => (callback) => {
        const listener = LocationEnabler.addListener(({ locationEnabled }) => {
          if (locationEnabled) {
            callback(model.events.LOCATION_ENABLED());
          } else {
            callback(model.events.LOCATION_DISABLED());
          }
        });

        LocationEnabler.checkSettings(context.locationConfig);

        return () => listener.remove();
      },

      checkAirplaneMode: (context) => (callback) => {
        SystemSetting.isAirplaneEnabled().then((enable) => {
          if(enable) {
            callback(model.events.FLIGHT_ENABLED());
          } else {
            callback(model.events.FLIGHT_DISABLED());
          }
        })
      },

      discoverDevice: () => (callback) => {
        SmartShare.createConnection('discoverer', () => {
          callback({ type: 'CONNECTED' });
        });
      },

      exchangeDeviceInfo: (context) => (callback) => {
        let subscription: EmitterSubscription;

        const message = new Message('exchange:sender-info', context.senderInfo);
        SmartShare.send(message.toString(), () => {
          subscription = SmartShare.handleNearbyEvents((event) => {
            if (event.type === 'onDisconnected') {
              callback({ type: 'DISCONNECT' });
            }

            if (event.type !== 'msg') return;
            const response = Message.fromString<DeviceInfo>(event.data);
            if (response.type === 'exchange:receiver-info') {
              callback({
                type: 'EXCHANGE_DONE',
                receiverInfo: response.data,
              });
            }
          });
        });

        return () => subscription?.remove();
      },

      sendVid: (context) => (callback) => {
        let subscription: EmitterSubscription;

        const vid = {
          ...context.selectedVid,
          tag: '',
        };

        const message = new Message<VC>('send:vid', vid);

        SmartShare.send(message.toString(), () => {
          subscription = SmartShare.handleNearbyEvents((event) => {
            if (event.type === 'onDisconnected') {
              callback({ type: 'DISCONNECT' });
            }

            if (event.type !== 'msg') return;

            const response = Message.fromString<SendVidStatus>(event.data);
            if (response.type === 'send:vid:response') {
              callback({
                type:
                  response.data.status === 'accepted'
                    ? 'VID_ACCEPTED'
                    : 'VID_REJECTED',
              });
            }
          });
        });

        return () => subscription?.remove();
      },
    },

    delays: {},

    guards: {
      isQrValid: (_, event: ScanEvent) => {
        const param: SmartShare.ConnectionParams = Object.create(null);
        try {
          Object.assign(param, JSON.parse(event.params));
          return 'cid' in param && 'pk' in param;
        } catch (e) {
          return false;
        }
      },
    },
  }
);

export function createScanMachine(serviceRefs: AppServices) {
  return scanMachine.withContext({
    ...scanMachine.context,
    serviceRefs,
  });
}

interface SendVidStatus {
  status: 'accepted' | 'rejected';
}

type State = StateFrom<typeof scanMachine>;

export function selectReceiverInfo(state: State) {
  return state.context.receiverInfo;
}

export function selectReason(state: State) {
  return state.context.reason;
}

export function selectVidName(state: State) {
  return state.context.vidName;
}

export function selectStatusMessage(state: State) {
  return (
    state.meta[`${state.machine.id}.${state.value}`]?.message ||
    state.meta[state.value.toString()]?.message ||
    ''
  );
}

export function selectScanning(state: State) {
  return state.matches('findingConnection');
}

export function selectReviewing(state: State) {
  return state.matches('reviewing');
}

export function selectSelectingVid(state: State) {
  return state.matches('reviewing.selectingVid');
}

export function selectSendingVid(state: State) {
  return state.matches('reviewing.sendingVid');
}

export function selectAccepted(state: State) {
  return state.matches('reviewing.accepted');
}

export function selectRejected(state: State) {
  return state.matches('reviewing.rejected');
}

export function selectInvalid(state: State) {
  return state.matches('invalid');
}

export function selectIsLocationDenied(state: State) {
  return state.matches('checkingLocationService.denied');
}

export function selectIsLocationDisabled(state: State) {
  return state.matches('checkingLocationService.disabled');
}

export function selectIsAirplaneEnabled(state: State) {
  return state.matches('checkingAirplaneMode.enabled');
}
