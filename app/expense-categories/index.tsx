import { useCallback, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
    <View className="flex-row items-center p-4 border-b">
      <TouchableOpacity
        className="flex-1"
        style={{ paddingLeft: item.depth * 16 }}
        onPress={() => handleEdit(item.item)}
      >
        <Text className="text-base">{item.item.label}</Text>
      </TouchableOpacity>
      <Button title="Delete" onPress={() => confirmDelete(item.item.id)} />
    </View>
  );

  return (
    <View className="flex-1">
      <View className="p-4 border-b">
        <Text className="mb-1">Label</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          className="border p-2 mb-3 rounded"
        />
        <Text className="mb-1">Prompt</Text>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          multiline
          className="border p-2 h-20 mb-3 rounded"
        />
        <Text className="mb-1">Parent</Text>
        <TouchableOpacity
          onPress={() => setParentVisible(true)}
          className="border p-2 mb-3 rounded"
        >
          <Text>{selectedParent ? selectedParent.label : 'None'}</Text>
        </TouchableOpacity>
        {error ? <Text className="text-red-500 mb-3">{error}</Text> : null}
        <Button
          title={editingId ? 'Update Category' : 'Add Category'}
          onPress={handleSubmit}
        />
        {editingId ? (
          <View className="mt-2">
            <Button title="Cancel" onPress={resetForm} />
          </View>
        ) : null}
      </View>
      <FlatList
        data={tree}
        keyExtractor={(i) => i.item.id}
        renderItem={renderItem}
      />
      <Modal visible={parentVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center">
          <View className="bg-white m-8 p-4 max-h-[80%]">
            <FlatList
              data={[{ item: null, depth: 0 }, ...parentOptions]}
              keyExtractor={(i, idx) => (i.item ? i.item.id : 'none') + idx}
              renderItem={({ item }) =>
                item.item ? (
                  <TouchableOpacity
                    className="p-2"
                    style={{ paddingLeft: item.depth * 16 }}
                    onPress={() => {
                      setParentId(item.item!.id);
                      setParentVisible(false);
                    }}
                  >
                    <Text>{item.item.label}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    className="p-2"
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
            <Button title="Close" onPress={() => setParentVisible(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

