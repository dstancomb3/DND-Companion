import React, { useState } from 'react';
import { View, Text, Button, ScrollView, ActivityIndicator } from 'react-native';
import { fetchOpen5eFeats, fetchOpen5eBackgrounds, fetchOpen5eConditions, fetchOpen5eMonsters } from '../utils/open5eApi';
import type { Open5eFeat, Open5eBackground, Open5eCondition, Open5eMonster } from '../types/index';

export const Open5eBrowser: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [feats, setFeats] = useState<Open5eFeat[]>([]);
  const [backgrounds, setBackgrounds] = useState<Open5eBackground[]>([]);
  const [conditions, setConditions] = useState<Open5eCondition[]>([]);
  const [monsters, setMonsters] = useState<Open5eMonster[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feats' | 'backgrounds' | 'conditions' | 'monsters'>('feats');

  const loadData = async (tab: typeof activeTab) => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'feats') setFeats(await fetchOpen5eFeats());
      if (tab === 'backgrounds') setBackgrounds(await fetchOpen5eBackgrounds());
      if (tab === 'conditions') setConditions(await fetchOpen5eConditions());
      if (tab === 'monsters') setMonsters(await fetchOpen5eMonsters());
    } catch (e: any) {
      setError(e.message || 'Failed to fetch data');
    }
    setLoading(false);
  };

  React.useEffect(() => {
    loadData(activeTab);
    // eslint-disable-next-line
  }, [activeTab]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <Button title="Feats" onPress={() => setActiveTab('feats')} />
        <Button title="Backgrounds" onPress={() => setActiveTab('backgrounds')} />
        <Button title="Conditions" onPress={() => setActiveTab('conditions')} />
        <Button title="Monsters" onPress={() => setActiveTab('monsters')} />
      </View>
      {loading && <ActivityIndicator size="large" />}
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <ScrollView>
        {activeTab === 'feats' && feats.map(f => (
          <View key={f.slug} style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: 'bold' }}>{f.name}</Text>
            <Text>{f.desc}</Text>
            {f.prerequisites && <Text>Prerequisites: {f.prerequisites}</Text>}
          </View>
        ))}
        {activeTab === 'backgrounds' && backgrounds.map(b => (
          <View key={b.slug} style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: 'bold' }}>{b.name}</Text>
            <Text>{b.desc}</Text>
            {b.feature && <Text>Feature: {b.feature}</Text>}
            {b.feature_desc && <Text>{b.feature_desc}</Text>}
          </View>
        ))}
        {activeTab === 'conditions' && conditions.map(c => (
          <View key={c.slug} style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: 'bold' }}>{c.name}</Text>
            <Text>{c.desc}</Text>
          </View>
        ))}
        {activeTab === 'monsters' && monsters.map(m => (
          <View key={m.slug} style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: 'bold' }}>{m.name} ({m.size} {m.type})</Text>
            <Text>HP: {m.hit_points} | AC: {m.armor_class} | CR: {m.challenge_rating}</Text>
            <Text>{m.alignment}</Text>
            <Text>{m.hit_dice}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};
