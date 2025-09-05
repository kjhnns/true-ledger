import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, TouchableOpacity, View } from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import {
  ExpenseCategory,
  ExpenseCategoryInput,
  expenseCategorySchema,
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from '../../lib/entities';

function buildChildrenMap(list: ExpenseCategory[]) {
  const map = new Map<string | null, ExpenseCategory[]>();
  for (const item of list) {
    const arr = map.get(item.parentId) || [];
    arr.push(item);
    map.set(item.parentId, arr);
  }
  return map;
}

function buildTree(list: ExpenseCategory[]) {
  const map = buildChildrenMap(list);
  const result: { item: ExpenseCategory; depth: number }[] = [];
  function walk(parentId: string | null, depth: number) {
    const children = map.get(parentId) || [];
    children.sort((a, b) => a.label.localeCompare(b.label));
    for (const child of children) {
      result.push({ item: child, depth });
      walk(child.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

function collectDescendants(
  id: string,
  map: Map<string | null, ExpenseCategory[]>,
  set: Set<string>
) {
  const children = map.get(id) || [];
  for (const child of children) {
    set.add(child.id);
    collectDescendants(child.id, map, set);
  }
}

export default function ExpenseCategoriesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [label, setLabel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [parentVisible, setParentVisible] = useState(false);
  const theme = useTheme();

  const load = useCallback(async () => {
    const data = await listExpenseCategories();
    setCategories(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const resetForm = () => {
    setLabel('');
    setPrompt('');
    setParentId(null);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async () => {
    const input: ExpenseCategoryInput = {
      label: label.trim(),
      prompt: prompt.trim(),
      parentId,
    };
    const parsed = expenseCategorySchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError('');
    if (editingId) {
      await updateExpenseCategory(editingId, parsed.data);
    } else {
      await createExpenseCategory(parsed.data);
    }
    resetForm();
    load();
  };

  const handleEdit = (item: ExpenseCategory) => {
    setEditingId(item.id);
    setLabel(item.label);
    setPrompt(item.prompt);
    setParentId(item.parentId);
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Delete category?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpenseCategory(id);
          if (editingId === id) resetForm();
          load();
        },
      },
    ]);
  };

  const tree = buildTree(categories);

  const childrenMap = buildChildrenMap(categories);
  const invalidIds = new Set<string>();
  if (editingId) {
    invalidIds.add(editingId);
    collectDescendants(editingId, childrenMap, invalidIds);
  }
  const parentOptions = buildTree(categories.filter((c) => !invalidIds.has(c.id)));

  const selectedParent = categories.find((c) => c.id === parentId) || null;

  const renderItem = ({
    item,
  }: {
    item: { item: ExpenseCategory; depth: number };
  }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
      }}
    >
      <TouchableOpacity
        style={{ flex: 1, paddingLeft: item.depth * 16 }}
        onPress={() => handleEdit(item.item)}
      >
        <Text style={{ fontSize: 16 }}>{item.item.label}</Text>
      </TouchableOpacity>
      <Button mode="outlined" onPress={() => confirmDelete(item.item.id)}>
        Delete
      </Button>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, borderBottomWidth: 1 }}>
        <Text style={{ marginBottom: 4 }}>Label</Text>
        <TextInput
          mode="outlined"
          value={label}
          onChangeText={setLabel}
          style={{ marginBottom: 12 }}
        />
        <Text style={{ marginBottom: 4 }}>Prompt</Text>
        <TextInput
          mode="outlined"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          style={{ marginBottom: 12, height: 80 }}
        />
        <Text style={{ marginBottom: 4 }}>Parent</Text>
        <TouchableOpacity
          onPress={() => setParentVisible(true)}
          style={{
            borderWidth: 1,
            padding: 8,
            marginBottom: 12,
            borderRadius: 4,
          }}
        >
          <Text>{selectedParent ? selectedParent.label : 'None'}</Text>
        </TouchableOpacity>
        {error ? (
          <Text style={{ color: theme.colors.error, marginBottom: 12 }}>{error}</Text>
        ) : null}
        <Button mode="outlined" onPress={handleSubmit}>
          {editingId ? 'Update Category' : 'Add Category'}
        </Button>
        {editingId ? (
          <View style={{ marginTop: 8 }}>
            <Button mode="outlined" onPress={resetForm}>Cancel</Button>
          </View>
        ) : null}
      </View>
      <FlatList
        data={tree}
        keyExtractor={(i) => i.item.id}
        renderItem={renderItem}
      />
      <Modal visible={parentVisible} transparent animationType="fade">
        <View
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }}
        >
          <View
            style={{ backgroundColor: 'white', margin: 32, padding: 16, maxHeight: '80%' }}
          >
            <FlatList
              data={[{ item: null, depth: 0 }, ...parentOptions]}
              keyExtractor={(i, idx) => (i.item ? i.item.id : 'none') + idx}
              renderItem={({ item }) =>
                item.item ? (
                  <TouchableOpacity
                    style={{ padding: 8, paddingLeft: item.depth * 16 }}
                    onPress={() => {
                      setParentId(item.item!.id);
                      setParentVisible(false);
                    }}
                  >
                    <Text>{item.item.label}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={{ padding: 8 }}
                    onPress={() => {
                      setParentId(null);
                      setParentVisible(false);
                    }}
                  >
                    <Text>None</Text>
                  </TouchableOpacity>
                )
              }
            />
            <Button mode="outlined" onPress={() => setParentVisible(false)}>
              Close
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

