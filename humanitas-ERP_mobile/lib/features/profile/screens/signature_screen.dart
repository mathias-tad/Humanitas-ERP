import 'dart:convert';
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';

class SignatureScreen extends StatefulWidget {
  final String? initialSignatureUrl;
  final Future<void> Function(String signatureUrl)? onSaveSignature;
  final Future<void> Function()? onDeleteSignature;

  const SignatureScreen({
    super.key,
    this.initialSignatureUrl,
    this.onSaveSignature,
    this.onDeleteSignature,
  });

  @override
  State<SignatureScreen> createState() => _SignatureScreenState();
}

class _SignatureScreenState extends State<SignatureScreen> {
  String? _signatureUrl;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _signatureUrl = widget.initialSignatureUrl;
  }

  Future<void> _handleUploadSample() async {
    const sampleBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    setState(() => _isLoading = true);

    try {
      if (widget.onSaveSignature != null) {
        await widget.onSaveSignature!(sampleBase64);
      }
      setState(() => _signatureUrl = sampleBase64);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Signature saved successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save signature: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleDelete() async {
    setState(() => _isLoading = true);
    try {
      if (widget.onDeleteSignature != null) {
        await widget.onDeleteSignature!();
      }
      setState(() => _signatureUrl = null);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Signature removed.'),
            backgroundColor: AppColors.info,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to remove signature: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _buildSignaturePreview() {
    if (_signatureUrl == null || _signatureUrl!.isEmpty) {
      return Container(
        key: const Key('signature_upload_box'),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(Icons.upload_file, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            const Text(
              'No Signature on File',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: Colors.black87),
            ),
            const SizedBox(height: 6),
            Text(
              'Sign on white paper, photograph, and upload.\nPNG or JPG recommended.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              key: const Key('signature_upload_btn'),
              onPressed: _isLoading ? null : _handleUploadSample,
              icon: const Icon(Icons.add_a_photo, size: 18),
              label: const Text('Upload Signature Photo'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      );
    }

    Widget imageWidget;
    if (_signatureUrl!.startsWith('data:image')) {
      try {
        final commaIdx = _signatureUrl!.indexOf(',');
        final b64 = commaIdx != -1 ? _signatureUrl!.substring(commaIdx + 1) : _signatureUrl!;
        imageWidget = Image.memory(
          base64Decode(b64),
          height: 80,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => const Icon(Icons.draw, size: 48, color: AppColors.primary),
        );
      } catch (_) {
        imageWidget = const Icon(Icons.draw, size: 48, color: AppColors.primary);
      }
    } else {
      imageWidget = Image.network(
        _signatureUrl!,
        height: 80,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => const Icon(Icons.draw, size: 48, color: AppColors.primary),
      );
    }

    return Container(
      key: const Key('signature_preview_box'),
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Center(child: imageWidget),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              OutlinedButton.icon(
                key: const Key('signature_replace_btn'),
                onPressed: _isLoading ? null : _handleUploadSample,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Replace'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                key: const Key('signature_remove_btn'),
                onPressed: _isLoading ? null : _handleDelete,
                icon: const Icon(Icons.delete_outline, size: 16),
                label: const Text('Remove'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: const BorderSide(color: AppColors.error),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Digital Signature'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Document Signature',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Your uploaded handwritten signature is automatically attached to employment contracts, offer letters, and generated HR documents.',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600, height: 1.4),
            ),
            const SizedBox(height: 24),
            _buildSignaturePreview(),
            const SizedBox(height: 20),
            if (_signatureUrl != null && _signatureUrl!.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, size: 20, color: Colors.green.shade700),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Signature verified and ready for document generation.',
                        style: TextStyle(fontSize: 13, color: Colors.green.shade900, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.only(top: 16),
                child: Center(child: CircularProgressIndicator()),
              ),
          ],
        ),
      ),
    );
  }
}
