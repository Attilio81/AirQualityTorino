import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'

export default function ErrorBanner({ message, onRetry }) {
  return (
    <Alert
      severity="error"
      action={<Button color="inherit" size="small" onClick={onRetry}>Riprova</Button>}
      sx={{ mb: 2 }}
    >
      {message}
    </Alert>
  )
}
