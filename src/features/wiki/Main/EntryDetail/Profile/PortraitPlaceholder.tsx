import styles from "./PortraitPlaceholder.module.css";

// Portrait placeholder — a 104px dashed drop target left of the entry name. No
// image assets by design.
export default function PortraitPlaceholder() {
  return (
    <div className={styles.portrait}>
      <span className={styles.label}>Drop an image</span>
    </div>
  );
}
