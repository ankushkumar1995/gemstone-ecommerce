/**
 * Admin shared components — single import surface for all admin pages.
 *
 *   import { Card, DataTable, StatCard, Tabs, Modal, ... } from "../_components";
 */

/* layout + primitives */
export { Card, PageHeader, AdminButton, AdminInput, StatusPill } from "./ui";
export { StatCard, type StatTone } from "./stat-card";
export {
  Badge,
  SearchInput,
  Avatar,
  CopyButton,
  Tooltip,
  ProgressBar,
  SegmentedControl,
} from "./primitives";

/* data display */
export { DataTable, EmptyState, type Column } from "./data-table";
export { Skeleton, TableSkeleton, StatsSkeleton } from "./skeleton";
export {
  Tabs,
  AdminBreadcrumb,
  KeyValueList,
  Pagination,
  FilterBar,
  DateRange,
} from "./navigation";
export { LineChart, BarChart, Donut } from "./charts";
export { ImageUpload, FileList, Timeline, InlineEdit } from "./media-misc";

/* overlays + forms + actions */
export { Modal, Drawer, ConfirmDialog } from "./overlays";
export { Field, AdminTextarea, AdminSelect, Toggle } from "./form";
export { AdminDropdown, type DropdownOption } from "./dropdown";
export { ActionMenu, type Action } from "./action-menu";
export { MediaPickerModal } from "./media-picker";
export { MediaLibrary } from "./media/media-library";
export { ImagePickerField } from "./image-picker-field";
export { RichTextEditor } from "./rich-text-editor";

/* feedback */
export { AdminToastProvider, useAdminToast } from "./toast";
