import { BaseCabinet, WallCabinet, Drawer, CabinetComponent } from '../types';

/**
 * Calculate door width based on cabinet width using piecewise formula from Excel
 * Formula: IF(AND(B>=10,B<=50),B-0.2,IF(AND(B>50,B<=100),B/2-0.2,IF(AND(B>100,B<=150),B/3-0.2,"")))
 */
export function calculateDoorWidth(cabinetWidth: number): number | null {
  if (cabinetWidth >= 10 && cabinetWidth <= 50) {
    return cabinetWidth - 0.2;
  } else if (cabinetWidth > 50 && cabinetWidth <= 100) {
    return cabinetWidth / 2 - 0.2;
  } else if (cabinetWidth > 100 && cabinetWidth <= 150) {
    return cabinetWidth / 3 - 0.2;
  }
  return null;
}

/**
 * Calculate number of doors based on cabinet width
 * Formula: IF(AND(B>=10,B<=50),1,IF(AND(B>50,B<=100),2,IF(AND(B>100,B<=150),3,"")))
 */
export function calculateDoorCount(cabinetWidth: number): number | null {
  if (cabinetWidth >= 10 && cabinetWidth <= 50) {
    return 1;
  } else if (cabinetWidth > 50 && cabinetWidth <= 100) {
    return 2;
  } else if (cabinetWidth > 100 && cabinetWidth <= 150) {
    return 3;
  }
  return null;
}

/**
 * Generate a unique ID for components
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Calculate base cabinet components based on Excel formulas
 */
export function calculateBaseCabinet(
  id: string,
  name: string,
  width: number,
  depth: number,
  height: number
): BaseCabinet {
  const shelfDepth = depth - 3; // Standard clearance

  // Floor: width = cabinet width, depth = cabinet depth
  const floor: CabinetComponent = {
    id: generateId(),
    name: 'Floor',
    nameFa: 'کف',
    width: width,
    height: depth,
    quantity: 1,
    material: 'mdf-16mm',
    edgeBanding: {
      enabled: false,
      thickness: 0,
      edges: { top: false, bottom: false, left: false, right: false },
    },
  };

  // Back panel: width = cabinet width - 3.2, height = cabinet height
  const back: CabinetComponent = {
    id: generateId(),
    name: 'Back',
    nameFa: 'بدنه',
    width: width - 3.2,
    height: height,
    quantity: 1,
    material: 'mdf-16mm',
    edgeBanding: {
      enabled: true,
      thickness: 1,
      edges: { top: true, bottom: true, left: true, right: true },
    },
  };

  // Body (sides): width = cabinet depth, height = cabinet height
  const body: CabinetComponent[] = [
    {
      id: generateId(),
      name: 'Left Side',
      nameFa: 'بدنه چپ',
      width: depth,
      height: height,
      quantity: 1,
      material: 'mdf-16mm',
      edgeBanding: {
        enabled: true,
        thickness: 1,
        edges: { top: true, bottom: true, left: false, right: true },
      },
    },
    {
      id: generateId(),
      name: 'Right Side',
      nameFa: 'بدنه راست',
      width: depth,
      height: height,
      quantity: 1,
      material: 'mdf-16mm',
      edgeBanding: {
        enabled: true,
        thickness: 1,
        edges: { top: true, bottom: true, left: true, right: false },
      },
    },
  ];

  // Shelf: width = cabinet width - 3.2, depth = shelf depth
  const shelf: CabinetComponent = {
    id: generateId(),
    name: 'Shelf',
    nameFa: 'طبقه',
    width: width - 3.2,
    height: shelfDepth,
    quantity: 1,
    material: 'mdf-16mm',
    edgeBanding: {
      enabled: false,
      thickness: 0,
      edges: { top: false, bottom: false, left: false, right: false },
    },
  };

  // Tie (top rail): width = cabinet depth, height = 7cm
  const tie: CabinetComponent = {
    id: generateId(),
    name: 'Tie',
    nameFa: 'قید',
    width: depth,
    height: 7,
    quantity: 1,
    material: 'mdf-16mm',
    edgeBanding: {
      enabled: false,
      thickness: 0,
      edges: { top: false, bottom: false, left: false, right: false },
    },
  };

  // 3mm strips
  const stripWidth = width - 1.6;
  const stripLength = height + 1.6 - 0.8;
  const strip3mm: CabinetComponent[] = [
    {
      id: generateId(),
      name: '3mm Strip 1',
      nameFa: 'نوار 3 میل 1',
      width: stripWidth,
      height: stripLength,
      quantity: 1,
      material: 'mdf-3mm',
      edgeBanding: {
        enabled: true,
        thickness: 1,
        edges: { top: false, bottom: false, left: true, right: true },
      },
    },
    {
      id: generateId(),
      name: '3mm Strip 2',
      nameFa: 'نوار 3 میل 2',
      width: stripWidth,
      height: stripLength,
      quantity: 1,
      material: 'mdf-3mm',
      edgeBanding: {
        enabled: true,
        thickness: 1,
        edges: { top: false, bottom: false, left: true, right: true },
      },
    },
  ];

  // Doors
  const doorWidth = calculateDoorWidth(width);
  const doorCount = calculateDoorCount(width);
  const door: CabinetComponent[] = [];
  if (doorWidth && doorCount) {
    for (let i = 0; i < doorCount; i++) {
      door.push({
        id: generateId(),
        name: `Door ${i + 1}`,
        nameFa: `درب ${i + 1}`,
        width: doorWidth,
        height: height,
        quantity: 1,
        material: 'mdf-16mm',
        edgeBanding: {
          enabled: true,
          thickness: 1,
          edges: { top: true, bottom: true, left: true, right: true },
        },
      });
    }
  }

  return {
    id,
    type: 'base',
    name,
    width,
    depth,
    height,
    shelfDepth,
    components: {
      floor,
      back,
      body,
      shelf,
      tie,
      strip3mm,
      door,
    },
  };
}

/**
 * Calculate wall cabinet components based on Excel formulas
 */
export function calculateWallCabinet(
  id: string,
  name: string,
  width: number,
  depth: number,
  height: number
): WallCabinet {
  // Body (sides): 2 pieces, width = cabinet depth, height = cabinet height
  const body: CabinetComponent[] = [
    {
      id: generateId(),
      name: 'Left Side',
      nameFa: 'بدنه چپ',
      width: depth,
      height: height,
      quantity: 1,
      material: 'mdf-16mm',
      edgeBanding: {
        enabled: true,
        thickness: 1,
        edges: { top: true, bottom: true, left: false, right: true },
      },
    },
    {
      id: generateId(),
      name: 'Right Side',
      nameFa: 'بدنه راست',
      width: depth,
      height: height,
      quantity: 1,
      material: 'mdf-16mm',
      edgeBanding: {
        enabled: true,
        thickness: 1,
        edges: { top: true, bottom: true, left: true, right: false },
      },
    },
  ];

  // Floor: width = cabinet width - 3.2, depth = cabinet depth
  const floor: CabinetComponent = {
    id: generateId(),
    name: 'Floor',
    nameFa: 'کف',
    width: width - 3.2,
    height: depth,
    quantity: 1,
    material: 'mdf-16mm',
    edgeBanding: {
      enabled: false,
      thickness: 0,
      edges: { top: false, bottom: false, left: false, right: false },
    },
  };

  // Top: width = cabinet depth - 2, height = cabinet width - 3.2
  const top: CabinetComponent = {
    id: generateId(),
    name: 'Top',
    nameFa: 'تاق',
    width: depth - 2,
    height: width - 3.2,
    quantity: 1,
    material: 'mdf-16mm',
    edgeBanding: {
      enabled: false,
      thickness: 0,
      edges: { top: false, bottom: false, left: false, right: false },
    },
  };

  // Shelf: width = cabinet width - 3.2, depth = cabinet depth - 3
  const shelf: CabinetComponent = {
    id: generateId(),
    name: 'Shelf',
    nameFa: 'طبقه',
    width: width - 3.2,
    height: depth - 3,
    quantity: 1,
    material: 'mdf-16mm',
    edgeBanding: {
      enabled: false,
      thickness: 0,
      edges: { top: false, bottom: false, left: false, right: false },
    },
  };

  // Tie: width = cabinet depth, height = cabinet width - 3.2
  const tie: CabinetComponent = {
    id: generateId(),
    name: 'Tie',
    nameFa: 'قید',
    width: depth,
    height: width - 3.2,
    quantity: 1,
    material: 'mdf-16mm',
    edgeBanding: {
      enabled: false,
      thickness: 0,
      edges: { top: false, bottom: false, left: false, right: false },
    },
  };

  // 3mm strips
  const stripWidth = width - 3.2 + 1.6;
  const stripLength = height - 0.8;
  const strip3mm: CabinetComponent[] = [
    {
      id: generateId(),
      name: '3mm Strip 1',
      nameFa: 'نوار 3 میل 1',
      width: stripWidth,
      height: stripLength,
      quantity: 1,
      material: 'mdf-3mm',
      edgeBanding: {
        enabled: true,
        thickness: 1,
        edges: { top: false, bottom: false, left: true, right: true },
      },
    },
    {
      id: generateId(),
      name: '3mm Strip 2',
      nameFa: 'نوار 3 میل 2',
      width: stripWidth,
      height: stripLength,
      quantity: 1,
      material: 'mdf-3mm',
      edgeBanding: {
        enabled: true,
        thickness: 1,
        edges: { top: false, bottom: false, left: true, right: true },
      },
    },
  ];

  // Doors
  const doorWidth = calculateDoorWidth(width);
  const doorCount = calculateDoorCount(width);
  const door: CabinetComponent[] = [];
  if (doorWidth && doorCount) {
    for (let i = 0; i < doorCount; i++) {
      door.push({
        id: generateId(),
        name: `Door ${i + 1}`,
        nameFa: `درب ${i + 1}`,
        width: doorWidth,
        height: 92, // Fixed door height for wall cabinets
        quantity: 1,
        material: 'mdf-16mm',
        edgeBanding: {
          enabled: true,
          thickness: 1,
          edges: { top: true, bottom: true, left: true, right: true },
        },
      });
    }
  }

  return {
    id,
    type: 'wall',
    name,
    width,
    depth,
    height,
    components: {
      body,
      floor,
      top,
      shelf,
      tie,
      strip3mm,
      door,
    },
  };
}

/**
 * Calculate drawer components based on Excel formulas
 */
export function calculateDrawer(
  id: string,
  name: string,
  depth: number,
  width: number,
  height: number,
  quantity: number
): Drawer {
  // Drawer sides: length = depth - 5, height = height/3 - 4
  const sideLength = depth - 5;
  const sideHeight = height / 3 - 4;

  const side: CabinetComponent[] = [];
  for (let i = 0; i < quantity * 2; i++) {
    side.push({
      id: generateId(),
      name: `Side ${i + 1}`,
      nameFa: `بدنه ${i + 1}`,
      width: sideLength,
      height: sideHeight,
      quantity: 1,
      material: 'mdf-16mm',
      edgeBanding: {
        enabled: false,
        thickness: 0,
        edges: { top: false, bottom: false, left: false, right: false },
      },
    });
  }

  // Drawer front: length = width - 9.1, height = height/3 - 4
  const frontLength = width - 9.1;
  const frontHeight = height / 3 - 4;

  const front: CabinetComponent[] = [];
  for (let i = 0; i < quantity; i++) {
    front.push({
      id: generateId(),
      name: `Front ${i + 1}`,
      nameFa: `جلو ${i + 1}`,
      width: frontLength,
      height: frontHeight,
      quantity: 1,
      material: 'mdf-16mm',
      edgeBanding: {
        enabled: false,
        thickness: 0,
        edges: { top: false, bottom: false, left: false, right: false },
      },
    });
  }

  // Drawer back: length = width - 9.1, height = height/3 - 4 - 2
  const backLength = width - 9.1;
  const backHeight = height / 3 - 4 - 2;

  const back: CabinetComponent[] = [];
  for (let i = 0; i < quantity; i++) {
    back.push({
      id: generateId(),
      name: `Back ${i + 1}`,
      nameFa: `پشت ${i + 1}`,
      width: backLength,
      height: backHeight,
      quantity: 1,
      material: 'mdf-16mm',
      edgeBanding: {
        enabled: false,
        thickness: 0,
        edges: { top: false, bottom: false, left: false, right: false },
      },
    });
  }

  return {
    id,
    type: 'drawer',
    name,
    depth,
    width,
    height,
    quantity,
    components: {
      side,
      front,
      back,
    },
  };
}
