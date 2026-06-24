import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useAppStore } from '../store/useAppStore';
import { identifyCard, assessCondition } from '../services/ximilar';
import { prepareImageForUpload, pickSharpest } from '../services/imageUtils';

const CAPTURE_STEPS = [
  { label: 'Front (straight on)', hint: 'Hold the card flat, fill the frame' },
  { label: 'Front (tilted)', hint: 'Tilt ~30° to reveal holo/foil pattern' },
  { label: 'Back (optional)', hint: 'Tap skip if not needed' },
];

export default function ScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);

  const { scanPhotos, addScanPhoto, clearScanPhotos, setScanResult, setScanCondition } = useAppStore();

  useEffect(() => { clearScanPhotos(); }, []);

  if (!permission) return <View style={s.center}><ActivityIndicator color="#3B82F6" /></View>;

  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={s.permText}>Camera access is required to scan cards.</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStep = CAPTURE_STEPS[step];

  async function capture() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
    addScanPhoto(photo.uri);
    if (step < CAPTURE_STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      await analyze([...scanPhotos, photo.uri]);
    }
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.9,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      addScanPhoto(uri);
      if (step < CAPTURE_STEPS.length - 1) setStep(s => s + 1);
      else await analyze([...scanPhotos, uri]);
    }
  }

  async function skipOptional() {
    await analyze(scanPhotos);
  }

  async function analyze(photos) {
    if (!photos.length) { Alert.alert('No photos', 'Take at least one photo first.'); return; }
    setLoading(true);
    try {
      const sharpestUri = await pickSharpest(photos);
      const base64 = await prepareImageForUpload(sharpestUri);

      const [identResult, condResult] = await Promise.allSettled([
        identifyCard(base64),
        assessCondition(base64),
      ]);

      const scanResult = identResult.status === 'fulfilled' ? identResult.value : null;
      const condition = condResult.status === 'fulfilled' ? condResult.value?.condition : 'NM';

      if (!scanResult?.card) {
        Alert.alert('Card not found', 'Could not identify the card. Try better lighting or a cleaner shot.');
        setLoading(false);
        return;
      }

      setScanResult(scanResult);
      setScanCondition(condition);
      navigation.navigate('ScanConfirm');
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Identification failed. Check your API key and connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <CameraView ref={cameraRef} style={s.camera} facing="back">
        {/* Card guide overlay */}
        <View style={s.overlay}>
          <View style={s.cardFrame} />
        </View>
      </CameraView>

      {/* Step indicator */}
      <View style={s.stepRow}>
        {CAPTURE_STEPS.map((st, i) => (
          <View key={i} style={[s.stepDot, i === step && s.stepDotActive, i < step && s.stepDotDone]} />
        ))}
      </View>

      <View style={s.hud}>
        <Text style={s.stepLabel}>{currentStep.label}</Text>
        <Text style={s.stepHint}>{currentStep.hint}</Text>

        {/* Thumbnail strip */}
        {scanPhotos.length > 0 && (
          <ScrollView horizontal style={s.thumbnails}>
            {scanPhotos.map((uri, i) => (
              <Image key={i} source={{ uri }} style={s.thumb} />
            ))}
          </ScrollView>
        )}

        <View style={s.btnRow}>
          {step === 2 && (
            <TouchableOpacity style={s.btnSecondary} onPress={skipOptional} disabled={loading}>
              <Text style={s.btnSecondaryText}>Skip</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.btnSecondary} onPress={pickFromLibrary} disabled={loading}>
            <Text style={s.btnSecondaryText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnCapture} onPress={capture} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <View style={s.captureInner} />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', padding: 20 },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cardFrame: {
    width: 240, height: 336, borderWidth: 2, borderColor: '#3B82F6',
    borderRadius: 12, backgroundColor: 'transparent',
  },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8, backgroundColor: '#0F172A' },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#334155' },
  stepDotActive: { backgroundColor: '#3B82F6', width: 20 },
  stepDotDone: { backgroundColor: '#22C55E' },
  hud: { backgroundColor: '#0F172A', padding: 16 },
  stepLabel: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  stepHint: { color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 4 },
  thumbnails: { flexDirection: 'row', marginTop: 10, marginBottom: 4 },
  thumb: { width: 48, height: 68, borderRadius: 4, marginRight: 6 },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, gap: 12 },
  btnCapture: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: '#3B82F6',
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff',
  },
  captureInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' },
  btnSecondary: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
  },
  btnSecondaryText: { color: '#94A3B8', fontWeight: '600' },
  permText: { color: '#94A3B8', textAlign: 'center', marginBottom: 16 },
  btn: { backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
});
