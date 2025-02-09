import React from 'react';
import {
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-elements';
import { mainRoutes } from '../routes/main';
import { RootRouteProps } from '../routes';
import { LanguageSelector } from '../components/LanguageSelector';
import { Colors } from '../components/ui/styleUtils';

const { Navigator, Screen } = createBottomTabNavigator();

export const MainLayout: React.FC<RootRouteProps> = () => {
  const options: BottomTabNavigationOptions = {
    headerLeft: () => <Icon name="notifications" color={Colors.Orange} />,
    headerLeftContainerStyle: { paddingStart: 16 },
    headerRight: () => <LanguageSelector />,
    headerRightContainerStyle: { paddingEnd: 16 },
    headerTitleAlign: 'center',
    tabBarShowLabel: false,
    tabBarStyle: { height: 86, paddingHorizontal: 36 },
  };

  return (
    <Navigator initialRouteName={mainRoutes[0].name} screenOptions={options}>
      {mainRoutes.map((route) => (
        <Screen
          key={route.name}
          name={route.name}
          component={route.component}
          options={{
            ...route.options,
            tabBarIcon: ({ focused }) => (
              <Icon
                name={route.icon}
                color={focused ? Colors.Orange : Colors.Grey}
                reverse={focused}
              />
            ),
          }}
        />
      ))}
    </Navigator>
  );
};
