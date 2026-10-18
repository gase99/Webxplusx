export type Language = 'fa' | 'en';

export type CabinetType = 'base' | 'wall' | 'tall' | 'drawer';

export interface Dimension {
  width: number;
  height: number;
  depth: number;
}

export interface Material {
  id: string;
  name: string;
  nameFa: string;
  thickness: number;
  pricePerSheet: number;
  sheetWidth: number;
  sheetHeight: number;
}

export interface EdgeBanding {
  enabled: boolean;
  thickness: number;
  edges: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
}

export interface CabinetComponent {
  id: string;
  name: string;
  nameFa: string;
  width: number;
  height: number;
  quantity: number;
  material: string;
  edgeBanding: EdgeBanding;
}

export interface BaseCabinet {
  id: string;
  type: 'base';
  name: string;
  width: number;
  depth: number;
  height: number;
  shelfDepth: number;
  components: {
    floor: CabinetComponent;
    back: CabinetComponent;
    body: CabinetComponent[];
    shelf: CabinetComponent;
    tie: CabinetComponent;
    strip3mm: CabinetComponent[];
    door: CabinetComponent[];
  };
}

export interface WallCabinet {
  id: string;
  type: 'wall';
  name: string;
  width: number;
  depth: number;
  height: number;
  components: {
    body: CabinetComponent[];
    floor: CabinetComponent;
    top: CabinetComponent;
    shelf: CabinetComponent;
    tie: CabinetComponent;
    strip3mm: CabinetComponent[];
    door: CabinetComponent[];
  };
}

export interface Drawer {
  id: string;
  type: 'drawer';
  name: string;
  depth: number;
  width: number;
  height: number;
  quantity: number;
  components: {
    side: CabinetComponent[];
    front: CabinetComponent[];
    back: CabinetComponent[];
  };
}

export type Cabinet = BaseCabinet | WallCabinet | Drawer;

export interface Project {
  id: string;
  name: string;
  nameFa: string;
  createdAt: Date;
  updatedAt: Date;
  cabinets: Cabinet[];
  notes?: string;
}

export interface CutListItem {
  id: string;
  cabinetId: string;
  cabinetName: string;
  componentName: string;
  width: number;
  height: number;
  quantity: number;
  material: string;
  edgeBanding: EdgeBanding;
}

export interface CutList {
  id: string;
  projectId: string;
  items: CutListItem[];
  createdAt: Date;
}

export interface SheetPart {
  id: string;
  cutListItemId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  label: string;
}

export interface SheetLayout {
  id: string;
  sheetIndex: number;
  sheetWidth: number;
  sheetHeight: number;
  parts: SheetPart[];
  wasteArea: number;
  utilization: number;
}

export interface OptimizationResult {
  id: string;
  cutListId: string;
  sheets: SheetLayout[];
  totalSheets: number;
  totalWaste: number;
  averageUtilization: number;
  createdAt: Date;
}

export interface Settings {
  language: Language;
  theme: 'light' | 'dark';
  defaultMaterial: string;
  sawKerf: number;
  sheetMargin: number;
}
