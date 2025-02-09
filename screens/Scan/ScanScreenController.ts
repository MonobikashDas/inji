import { useSelector } from '@xstate/react';
import { useContext, useEffect } from 'react';
import {
  ScanEvents,
  selectInvalid,
  selectIsAirplaneEnabled,
  selectIsLocationDisabled,
  selectIsLocationDenied,
  selectReviewing,
  selectScanning,
  selectStatusMessage,
} from '../../machines/scan';
import { selectVidLabel } from '../../machines/settings';
import { selectShareableVids } from '../../machines/vid';
import { MainRouteProps } from '../../routes/main';
import { GlobalContext } from '../../shared/GlobalContext';

export function useScanScreen({ navigation }: MainRouteProps) {
  const { appService } = useContext(GlobalContext);
  const scanService = appService.children.get('scan');
  const settingsService = appService.children.get('settings');
  const vidService = appService.children.get('vid');

  const shareableVids = useSelector(vidService, selectShareableVids);
  const isInvalid = useSelector(scanService, selectInvalid);

  const isLocationDisabled = useSelector(scanService, selectIsLocationDisabled);
  const isLocationDenied = useSelector(scanService, selectIsLocationDenied);
  const isFlightMode = useSelector(scanService, selectIsAirplaneEnabled);

  const locationError = { message: '', button: '' };
  if(isFlightMode) {
    locationError.message =
        'Flight mode must be disabled for the scanning functionality';
      locationError.button = 'Disable flight mode';
  } else {
    if (isLocationDisabled) {
      locationError.message =
        'Location services must be enabled for the scanning functionality';
      locationError.button = 'Enable location services';
    } else if (isLocationDenied) {
      locationError.message =
        'Location permission is required for the scanning functionality';
      locationError.button = 'Allow access to location';
    }
  }

  useEffect(() => {
    const subscriptions = [
      navigation.addListener('focus', () =>
        scanService.send(ScanEvents.SCREEN_FOCUS())
      ),
      navigation.addListener('blur', () =>
        scanService.send(ScanEvents.SCREEN_BLUR())
      ),
    ];

    const navSubscription = scanService.subscribe((state) => {
      if (state.matches('reviewing.navigatingToHome')) {
        navigation.navigate('Home', { activeTab: 0 });
      }
    });

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      navSubscription.unsubscribe();
    };
  }, []);

  return {
    locationError,
    statusMessage: useSelector(scanService, selectStatusMessage),
    vidLabel: useSelector(settingsService, selectVidLabel),

    isInvalid,
    isEmpty: !shareableVids.length,
    isLocationDisabled,
    isLocationDenied,
    isScanning: useSelector(scanService, selectScanning),
    isReviewing: useSelector(scanService, selectReviewing),
    isFlightMode,

    DISMISS: () => scanService.send(ScanEvents.DISMISS()),
    LOCATION_REQUEST: () => scanService.send(ScanEvents.LOCATION_REQUEST()),
    FLIGHT_REQUEST: () => scanService.send(ScanEvents.FLIGHT_REQUEST()),
    SCAN: (qrCode: string) => scanService.send(ScanEvents.SCAN(qrCode)),
    DISMISS_INVALID: () => {
      if(isInvalid) {
        scanService.send(ScanEvents.DISMISS())
      }
    }
  };
}
