import React, { useContext, useRef } from 'react';
import { useInterpret, useSelector } from '@xstate/react';
import { Pressable, StyleSheet } from 'react-native';
import { CheckBox, Icon } from 'react-native-elements';
import { ActorRefFrom } from 'xstate';
import {
  createVidItemMachine,
  selectVerifiableCredential,
  selectGeneratedOn,
  selectTag,
  selectId,
  vidItemMachine,
} from '../machines/vidItem';
import { Column, Row, Text } from './ui';
import { Colors } from './ui/styleUtils';
import { RotatingIcon } from './RotatingIcon';
import { GlobalContext } from '../shared/GlobalContext';

const styles = StyleSheet.create({
  title: {
    color: Colors.Black,
    backgroundColor: 'transparent',
  },
  loadingTitle: {
    color: 'transparent',
    backgroundColor: Colors.Grey5,
    borderRadius: 4,
  },
  subtitle: {
    backgroundColor: 'transparent',
  },
  loadingSubtitle: {
    backgroundColor: Colors.Grey,
    borderRadius: 4,
  },
  container: {
    backgroundColor: Colors.White,
  },
  loadingContainer: {
    backgroundColor: Colors.Grey6,
    borderRadius: 4,
  },
});

export const VidItem: React.FC<VidItemProps> = (props) => {
  const { appService } = useContext(GlobalContext);
  const machine = useRef(
    createVidItemMachine(
      appService.getSnapshot().context.serviceRefs,
      props.vidKey
    )
  );
  const service = useInterpret(machine.current);
  const uin = useSelector(service, selectId);
  const tag = useSelector(service, selectTag);
  const verifiableCredential = useSelector(service, selectVerifiableCredential);
  const generatedOn = useSelector(service, selectGeneratedOn);

  return (
    <Pressable
      onPress={() => props.onPress(service)}
      disabled={!verifiableCredential}>
      <Row
        elevation={!verifiableCredential ? 0 : 2}
        crossAlign="center"
        margin={props.margin}
        backgroundColor={!verifiableCredential ? Colors.Grey6 : Colors.White}
        padding="16 24"
        style={
          !verifiableCredential ? styles.loadingContainer : styles.container
        }>
        <Column fill margin="0 24 0 0">
          <Text
            weight="semibold"
            style={!verifiableCredential ? styles.loadingTitle : styles.title}
            margin="0 0 6 0">
            {!verifiableCredential ? '' : tag || uin}
          </Text>
          <Text
            size="smaller"
            numLines={1}
            style={
              !verifiableCredential ? styles.loadingSubtitle : styles.subtitle
            }>
            {!verifiableCredential
              ? ''
              : verifiableCredential.credentialSubject.fullName +
                ' · ' +
                generatedOn}
          </Text>
        </Column>
        {verifiableCredential ? (
          props.selectable ? (
            <CheckBox
              checked={props.selected}
              checkedIcon={<Icon name="radio-button-checked" />}
              uncheckedIcon={<Icon name="radio-button-unchecked" />}
              onPress={() => props.onPress(service)}
            />
          ) : (
            <Icon name="chevron-right" />
          )
        ) : (
          <RotatingIcon name="sync" color={Colors.Grey5} />
        )}
      </Row>
    </Pressable>
  );
};

interface VidItemProps {
  vidKey: string;
  margin?: string;
  selectable?: boolean;
  selected?: boolean;
  onPress?: (vidRef?: ActorRefFrom<typeof vidItemMachine>) => void;
}
