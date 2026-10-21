import React from 'react';
import {
  FiAlertTriangle, FiArchive, FiArrowDown, FiArrowLeft, FiArrowRight, FiArrowUp, FiBarChart2, FiBell,
  FiBox, FiCheck, FiCheckCircle, FiClock, FiCoffee, FiCopy, FiCreditCard, FiDelete, FiDownload,
  FiDroplet, FiEdit, FiEye, FiFile, FiFileText, FiGlobe, FiGrid, FiHash, FiHelpCircle, FiHome,
  FiImage, FiInbox, FiInfo, FiList, FiLogOut, FiMapPin, FiMaximize, FiMenu, FiMinus, FiMoon,
  FiPackage, FiPlus, FiPrinter, FiSearch, FiShoppingBag, FiShoppingCart, FiShuffle, FiSliders,
  FiSun, FiTag, FiTrash2, FiTrendingUp, FiUpload, FiUser, FiVolume2, FiX, FiZap, FiCircle,
} from 'react-icons/fi';

// Feather has no peso icon, so just use the sign
const Peso = ({ size }) => <span style={{ fontSize: size, lineHeight: 1, fontWeight: 700 }}>₱</span>;

// usage: <Icon name="printer" size={18} />
const icons = {
  cart: FiShoppingCart,
  sun: FiSun,
  moon: FiMoon,
  printer: FiPrinter,
  globe: FiGlobe,
  help: FiHelpCircle,
  pin: FiMapPin,
  file: FiFile,
  user: FiUser,
  home: FiHome,
  plus: FiPlus,
  minus: FiMinus,
  scan: FiMaximize,
  hash: FiHash,
  keyboard: FiHash,
  trash: FiTrash2,
  cash: Peso,
  card: FiCreditCard,
  check: FiCheck,
  'check-circle': FiCheckCircle,
  x: FiX,
  alert: FiAlertTriangle,
  info: FiInfo,
  dot: FiCircle,
  'arrow-up': FiArrowUp,
  'arrow-down': FiArrowDown,
  'arrow-left': FiArrowLeft,
  'arrow-right': FiArrowRight,
  download: FiDownload,
  upload: FiUpload,
  search: FiSearch,
  list: FiList,
  box: FiBox,
  tag: FiTag,
  bell: FiBell,
  chart: FiBarChart2,
  trend: FiTrendingUp,
  zap: FiZap,
  sliders: FiSliders,
  eye: FiEye,
  receipt: FiFileText,
  megaphone: FiVolume2,
  shuffle: FiShuffle,
  backspace: FiDelete,
  image: FiImage,
  inbox: FiInbox,
  table: FiGrid,
  clock: FiClock,
  copy: FiCopy,
  logout: FiLogOut,
  edit: FiEdit,
  archive: FiArchive,
  menu: FiMenu,
  drink: FiCoffee,
  snack: FiShoppingBag,
  food: FiPackage,
  soap: FiDroplet,
};

export default function Icon({ name, size = 20, className = '', ...rest }) {
  const Component = icons[name] || FiBox;
  return (
    <Component
      size={size}
      className={`ico ${className}`}
      strokeWidth={2.25}
      aria-hidden="true"
      style={{ flex: 'none', verticalAlign: '-0.2em' }}
      {...rest}
    />
  );
}

// temporary icon for a product based on its category 
export function categoryIconName(category = '') {
  const c = String(category).toLowerCase();
  if (/drink|beverage|coffee|water|juice|soda/.test(c)) return 'drink';
  if (/snack|chip|candy|sweet|biscuit/.test(c)) return 'snack';
  if (/food|noodle|rice|canned|grocer|instant/.test(c)) return 'food';
  if (/care|soap|hygiene|beauty|shampoo/.test(c)) return 'soap';
  if (/home|house|clean|school|office|supply/.test(c)) return 'home';
  return 'box';
}

export function ProductIcon({ product, size = 22 }) {
  return <Icon name={categoryIconName(product && product.category)} size={size} />;
}
