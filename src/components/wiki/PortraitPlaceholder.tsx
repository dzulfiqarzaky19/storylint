import styles from "./PortraitPlaceholder.module.css";

// Portrait placeholder: 100% x 210px, rule fill, 2px ink border, grayscale,
// label bottom-left (README Screen 1 right column). No image assets by design.
export default function PortraitPlaceholder() {
  return (
    <div className={styles.portrait}>
      <span className={styles.label}>Portrait — drop an image</span>
    </div>
  );
}
