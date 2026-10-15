# PDF: comprobacion local del contenedor P12/PFX con Crypt32 de Windows.
# No importa certificados, no firma y no realiza conexiones de red.
# Compatible con Windows PowerShell 5.1. Distribuir con UTF-8 BOM.
$ErrorActionPreference = 'Stop'
$script:Report = [ordered]@{
    Diagnostico = 'PDF_P12_WINDOWS_2'
    Estado = 'NO_EJECUTADO'
    Formato_PFX_reconocido_por_Windows = 'NO_COMPROBADO'
    Resultado_API_PFXVerifyPassword = 'NO_COMPROBADO'
    Datos_personales_certificado = 'NO_INCLUIDOS'
    Certificado_o_password_en_informe = 'NO_INCLUIDOS'
}
$stage = 'INICIO'
$bytes = $null
$handle = $null
$secret = $null
$pointer = [IntPtr]::Zero
$dialog = $null

try {
    Write-Host 'PDF - Comprobar el P12/PFX con Windows'
    Write-Host ''
    Write-Host 'Elige exactamente el mismo archivo que falla en PDF.'
    Write-Host 'Se consulta una API de Windows. No se instala el certificado ni se firma nada.'
    Write-Host 'Esto NO comprueba el certificado instalado que utilizas en otras aplicaciones.'
    Write-Host 'El informe solo contiene el resultado; no incluye archivo, nombre ni password.'
    Write-Host ''
    $stage = 'SELECCION_ARCHIVO'
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = 'Selecciona el mismo P12/PFX que falla en PDF'
    $dialog.Filter = 'Certificados P12/PFX (*.p12;*.pfx)|*.p12;*.pfx|Todos los archivos (*.*)|*.*'
    $dialog.CheckFileExists = $true
    $dialog.Multiselect = $false
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        $script:Report.Estado = 'CANCELADO'
    } else {
        $stage = 'LECTURA_ARCHIVO'
        $item = Get-Item -LiteralPath $dialog.FileName
        if ($item.Length -eq 0 -or $item.Length -gt 5MB) {
            $script:Report.Estado = 'ARCHIVO_VACIO_O_MAYOR_DE_5_MB'
        } else {
            $bytes = [System.IO.File]::ReadAllBytes($dialog.FileName)
            $stage = 'CARGA_LECTOR_WINDOWS'
            Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PdfPfxWindows {
    [StructLayout(LayoutKind.Sequential)]
    public struct Blob {
        public uint Size;
        public IntPtr Data;
    }
    [DllImport("crypt32.dll", ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool PFXIsPFXBlob(ref Blob data);
    [DllImport("crypt32.dll", ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool PFXVerifyPassword(ref Blob data, IntPtr password, uint flags);
}
'@
            $handle = [System.Runtime.InteropServices.GCHandle]::Alloc($bytes, [System.Runtime.InteropServices.GCHandleType]::Pinned)
            $blob = New-Object -TypeName 'PdfPfxWindows+Blob'
            $blob.Size = [uint32]$bytes.Length
            $blob.Data = $handle.AddrOfPinnedObject()
            $stage = 'FORMATO_PFX'
            if (-not [PdfPfxWindows]::PFXIsPFXBlob([ref]$blob)) {
                $script:Report.Formato_PFX_reconocido_por_Windows = 'NO'
                $script:Report.Estado = 'WINDOWS_NO_RECONOCE_PFX'
            } else {
                $script:Report.Formato_PFX_reconocido_por_Windows = 'SI'
                $stage = 'PASSWORD'
                $secret = Read-Host 'Escribe la misma password del P12/PFX (no se muestra)' -AsSecureString
                $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($secret)
                $stage = 'VERIFICACION_WINDOWS'
                $accepted = [PdfPfxWindows]::PFXVerifyPassword([ref]$blob, $pointer, 0)
                if (-not $accepted -and $secret.Length -eq 0) {
                    $accepted = [PdfPfxWindows]::PFXVerifyPassword([ref]$blob, [IntPtr]::Zero, 0)
                }
                if ($accepted) {
                    $script:Report.Resultado_API_PFXVerifyPassword = 'TRUE'
                    $script:Report.Estado = 'API_PFX_VERIFICA'
                } else {
                    $script:Report.Resultado_API_PFXVerifyPassword = 'FALSE'
                    $script:Report.Estado = 'API_PFX_NO_VERIFICA'
                }
            }
        }
    }
} catch {
    # Never write exception text: it can contain a private file path.
    $script:Report.Estado = 'NO_SE_PUDO_EJECUTAR'
    $script:Report.Fase = $stage
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($pointer) }
    if ($secret) { $secret.Dispose() }
    if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    if ($null -ne $handle -and $handle.IsAllocated) { $handle.Free() }
    if ($dialog) { $dialog.Dispose() }
}

$lines = @('PDF - Resultado de comprobacion local', '')
foreach ($entry in $script:Report.GetEnumerator()) { $lines += "$($entry.Key): $($entry.Value)" }
$lines += ''
switch ($script:Report.Estado) {
    'API_PFX_VERIFICA' {
        $lines += 'PFXVerifyPassword devuelve TRUE para este archivo y password. No equivale a una importacion completa ni a una prueba de firma. Si PDF falla con los mismos datos, investigar la diferencia entre lectores.'
    }
    'API_PFX_NO_VERIFICA' {
        $lines += 'PFXVerifyPassword devuelve FALSE en esta prueba. El resultado no identifica la causa, no descarta un fallo de PDF o del diagnostico y NO permite concluir que Windows no pueda usar tu certificado instalado.'
    }
    'WINDOWS_NO_RECONOCE_PFX' {
        $lines += 'Windows no reconoce este archivo como un P12/PFX. Comprueba que seleccionaste el fichero correcto.'
    }
    default { $lines += 'La comprobacion no se ha completado. Comparte este estado, sin certificado ni password.' }
}
$lines += 'Esta comprobacion no verifica caducidad, revocacion, confianza, disponibilidad de clave privada ni validez para tramites.'
$lines += 'No se ha instalado ningun certificado ni modificado el P12/PFX. El programa no sube archivos ni passwords; la comprobacion la realiza Windows.'
$text = $lines -join [Environment]::NewLine
Write-Host ''
Write-Host $text
$resultPath = Join-Path $PSScriptRoot 'RESULTADO_PARA_COMPARTIR.txt'
try {
    [System.IO.File]::WriteAllText($resultPath, $text, (New-Object System.Text.UTF8Encoding($true)))
    Write-Host ''
    Write-Host 'Resultado guardado junto a este programa: RESULTADO_PARA_COMPARTIR.txt'
    Write-Host 'Puedes compartir solo ese TXT. Conserva el P12/PFX y la password en tu equipo.'
} catch {
    Write-Host 'No se pudo guardar el TXT en esta carpeta. Copia solo el resultado mostrado arriba.'
}
