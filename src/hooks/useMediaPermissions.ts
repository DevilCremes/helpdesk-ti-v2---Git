import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

export function useMediaPermissions() {
  const requestCamera = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissao necessaria',
        'Acesse Configuracoes do dispositivo e habilite a camera para este app.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configuracoes', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  };

  const requestGallery = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissao necessaria',
        'Acesse Configuracoes do dispositivo e habilite o acesso a fotos para este app.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configuracoes', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  };

  return { requestCamera, requestGallery };
}
