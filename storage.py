import json
from pathlib import Path
from typing import List, Optional, Type, TypeVar
from pydantic import BaseModel

T = TypeVar('T', bound=BaseModel)

class JSONStorage:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, model: BaseModel, filename: str) -> bool:
        try:
            file_path = self.base_dir / filename
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(model.model_dump(mode='json'), f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Save error: {e}")
            return False

    def load(self, filename: str, model_class: Type[T]) -> Optional[T]:
        try:
            file_path = self.base_dir / filename
            if not file_path.exists():
                return None
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return model_class(**data)
        except Exception as e:
            print(f"Load error: {e}")
            return None

    def list_all(self, model_class: Type[T]) -> List[T]:
        items = []
        for file_path in self.base_dir.glob('*.json'):
            item = self.load(file_path.name, model_class)
            if item:
                items.append(item)
        return items
