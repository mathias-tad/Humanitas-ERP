import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:humanitas_erp_mobile/features/profile/screens/signature_screen.dart';

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('SignatureScreen Widget Tests', () {
    testWidgets('renders empty state when no initial signature is provided',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: SignatureScreen(),
        ),
      );

      expect(find.text('My Digital Signature'), findsOneWidget);
      expect(find.text('Document Signature'), findsOneWidget);
      expect(find.byKey(const Key('signature_upload_box')), findsOneWidget);
      expect(find.text('No Signature on File'), findsOneWidget);
      expect(find.byKey(const Key('signature_upload_btn')), findsOneWidget);
    });

    testWidgets('renders preview with Replace and Remove buttons when signature exists',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: SignatureScreen(
            initialSignatureUrl:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          ),
        ),
      );

      expect(find.byKey(const Key('signature_preview_box')), findsOneWidget);
      expect(find.byKey(const Key('signature_replace_btn')), findsOneWidget);
      expect(find.byKey(const Key('signature_remove_btn')), findsOneWidget);
      expect(find.text('Signature verified and ready for document generation.'),
          findsOneWidget);
    });

    testWidgets('uploading sample signature updates UI and calls onSaveSignature',
        (WidgetTester tester) async {
      String? savedUrl;

      await tester.pumpWidget(
        MaterialApp(
          home: SignatureScreen(
            onSaveSignature: (url) async {
              savedUrl = url;
            },
          ),
        ),
      );

      expect(find.byKey(const Key('signature_upload_btn')), findsOneWidget);
      await tester.tap(find.byKey(const Key('signature_upload_btn')));
      await tester.pumpAndSettle();

      expect(savedUrl, isNotNull);
      expect(find.byKey(const Key('signature_preview_box')), findsOneWidget);
      expect(find.text('Signature saved successfully!'), findsOneWidget);
    });

    testWidgets('clicking remove button calls onDeleteSignature and reverts to empty state',
        (WidgetTester tester) async {
      bool deleteCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: SignatureScreen(
            initialSignatureUrl:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            onDeleteSignature: () async {
              deleteCalled = true;
            },
          ),
        ),
      );

      expect(find.byKey(const Key('signature_remove_btn')), findsOneWidget);
      await tester.tap(find.byKey(const Key('signature_remove_btn')));
      await tester.pumpAndSettle();

      expect(deleteCalled, isTrue);
      expect(find.byKey(const Key('signature_upload_box')), findsOneWidget);
      expect(find.text('Signature removed.'), findsOneWidget);
    });
  });
}
