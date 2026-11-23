// src/app/ads/NativeAdModal.tsx

import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

interface NativeAdModalProps {
  visible: boolean;
  onClose: () => void;
  unitId?: string;
}

const { width } = Dimensions.get('window');

export const NativeAdModal: React.FC<NativeAdModalProps> = ({
  visible,
  onClose,
  unitId = TestIds.NATIVE,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.bottomSheetContainer}>
              {/* Top Bar / Close indicator */}
              <View style={styles.sheetHandle} />
              
              <View style={styles.adHeaderRow}>
                <View style={styles.adBadge}>
                  <Text style={styles.adBadgeText}>Ad (Test)</Text>
                </View>
                <Text style={styles.adSource}>Google Mobile Ads • Native</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.adBody}>
                <Text style={styles.adTitle}>Unlock Full AI Experience</Text>
                <Text style={styles.adSubtitle}>
                  Using Ad Unit ID: {unitId}
                </Text>
                <Text style={styles.adDescription}>
                  Experience lightning-fast AI responses, multiple assistants, and seamless multi-language translation.
                </Text>

                <TouchableOpacity style={styles.installButton} onPress={onClose}>
                  <Text style={styles.installButtonText}>Install Now / Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end', // Aligns modal to the bottom of the screen
  },
  bottomSheetContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: '#334155',
    width: width,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  adHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  adBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  adSource: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginLeft: 10,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  adBody: {
    marginTop: 4,
  },
  adTitle: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  adSubtitle: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  adDescription: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  installButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  installButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});