import styles from "./PortraitPlaceholder.module.css";

export default function PortraitPlaceholder() {
  return (
    <div className={styles.portrait}>
      <span className={styles.label}>Drop an image</span>
    </div>
  );
}
