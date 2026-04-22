export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      abonnements: {
        Row: {
          adresse_facturation: Json | null
          created_at: string
          debut_le: string
          derniere_facture_id: string | null
          fin_essai_le: string | null
          fin_periode_le: string | null
          id: string
          montant_cents: number | null
          nb_echecs_paiement: number | null
          plan: Database["public"]["Enums"]["plan_abonnement"]
          prestataire_id: string
          resilie_le: string | null
          statut: Database["public"]["Enums"]["statut_abonnement"]
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          adresse_facturation?: Json | null
          created_at?: string
          debut_le?: string
          derniere_facture_id?: string | null
          fin_essai_le?: string | null
          fin_periode_le?: string | null
          id?: string
          montant_cents?: number | null
          nb_echecs_paiement?: number | null
          plan?: Database["public"]["Enums"]["plan_abonnement"]
          prestataire_id: string
          resilie_le?: string | null
          statut?: Database["public"]["Enums"]["statut_abonnement"]
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          adresse_facturation?: Json | null
          created_at?: string
          debut_le?: string
          derniere_facture_id?: string | null
          fin_essai_le?: string | null
          fin_periode_le?: string | null
          id?: string
          montant_cents?: number | null
          nb_echecs_paiement?: number | null
          plan?: Database["public"]["Enums"]["plan_abonnement"]
          prestataire_id?: string
          resilie_le?: string | null
          statut?: Database["public"]["Enums"]["statut_abonnement"]
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "abonnements_prestataire_id_fkey"
            columns: ["prestataire_id"]
            isOneToOne: false
            referencedRelation: "prestataires"
            referencedColumns: ["id"]
          },
        ]
      }
      articles_blog: {
        Row: {
          articles_lies: string[]
          auteur: string | null
          auteur_id: string | null
          balise_canonique: string | null
          builder_io_content_id: string | null
          categorie_blog: string | null
          categorie_liee_slug: string | null
          contenu: string | null
          created_at: string
          est_publie: boolean | null
          extrait: string | null
          faq: Json
          id: string
          image_couverture_url: string | null
          inclure_sitemap: boolean
          legende_image: string | null
          meta_description: string | null
          meta_title: string | null
          noindex: boolean
          og_image_url: string | null
          prestataires_lies: string[]
          publie_le: string | null
          slug: string
          tags: string[] | null
          temps_lecture: number | null
          titre: string
          updated_at: string
        }
        Insert: {
          articles_lies?: string[]
          auteur?: string | null
          auteur_id?: string | null
          balise_canonique?: string | null
          builder_io_content_id?: string | null
          categorie_blog?: string | null
          categorie_liee_slug?: string | null
          contenu?: string | null
          created_at?: string
          est_publie?: boolean | null
          extrait?: string | null
          faq?: Json
          id?: string
          image_couverture_url?: string | null
          inclure_sitemap?: boolean
          legende_image?: string | null
          meta_description?: string | null
          meta_title?: string | null
          noindex?: boolean
          og_image_url?: string | null
          prestataires_lies?: string[]
          publie_le?: string | null
          slug: string
          tags?: string[] | null
          temps_lecture?: number | null
          titre: string
          updated_at?: string
        }
        Update: {
          articles_lies?: string[]
          auteur?: string | null
          auteur_id?: string | null
          balise_canonique?: string | null
          builder_io_content_id?: string | null
          categorie_blog?: string | null
          categorie_liee_slug?: string | null
          contenu?: string | null
          created_at?: string
          est_publie?: boolean | null
          extrait?: string | null
          faq?: Json
          id?: string
          image_couverture_url?: string | null
          inclure_sitemap?: boolean
          legende_image?: string | null
          meta_description?: string | null
          meta_title?: string | null
          noindex?: boolean
          og_image_url?: string | null
          prestataires_lies?: string[]
          publie_le?: string | null
          slug?: string
          tags?: string[] | null
          temps_lecture?: number | null
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_blog_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      avis: {
        Row: {
          client_id: string | null
          commentaire: string
          contact_id: string | null
          created_at: string
          demande_id: string | null
          id: string
          note_flexibilite: number
          note_globale: number
          note_professionnalisme: number
          note_qualite_presta: number
          note_rapport_qualite_prix: number
          prestataire_id: string
          reponse_prestataire: string | null
          statut: Database["public"]["Enums"]["statut_avis"]
          titre: string | null
        }
        Insert: {
          client_id?: string | null
          commentaire: string
          contact_id?: string | null
          created_at?: string
          demande_id?: string | null
          id?: string
          note_flexibilite: number
          note_globale: number
          note_professionnalisme: number
          note_qualite_presta: number
          note_rapport_qualite_prix: number
          prestataire_id: string
          reponse_prestataire?: string | null
          statut?: Database["public"]["Enums"]["statut_avis"]
          titre?: string | null
        }
        Update: {
          client_id?: string | null
          commentaire?: string
          contact_id?: string | null
          created_at?: string
          demande_id?: string | null
          id?: string
          note_flexibilite?: number
          note_globale?: number
          note_professionnalisme?: number
          note_qualite_presta?: number
          note_rapport_qualite_prix?: number
          prestataire_id?: string
          reponse_prestataire?: string | null
          statut?: Database["public"]["Enums"]["statut_avis"]
          titre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_anonymes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes_devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_prestataire_id_fkey"
            columns: ["prestataire_id"]
            isOneToOne: false
            referencedRelation: "prestataires"
            referencedColumns: ["id"]
          },
        ]
      }
      boosts_visibilite: {
        Row: {
          capacite_max: number | null
          created_at: string
          debut_le: string
          emplacement: Database["public"]["Enums"]["emplacement_boost"]
          fin_le: string
          id: string
          montant_cents: number
          motif_admin: string | null
          pack: Database["public"]["Enums"]["pack_boost"]
          prestataire_id: string
          source: Database["public"]["Enums"]["source_boost"] | null
          statut: Database["public"]["Enums"]["statut_boost"]
          stripe_payment_intent_id: string | null
          zone: string | null
        }
        Insert: {
          capacite_max?: number | null
          created_at?: string
          debut_le: string
          emplacement: Database["public"]["Enums"]["emplacement_boost"]
          fin_le: string
          id?: string
          montant_cents: number
          motif_admin?: string | null
          pack: Database["public"]["Enums"]["pack_boost"]
          prestataire_id: string
          source?: Database["public"]["Enums"]["source_boost"] | null
          statut?: Database["public"]["Enums"]["statut_boost"]
          stripe_payment_intent_id?: string | null
          zone?: string | null
        }
        Update: {
          capacite_max?: number | null
          created_at?: string
          debut_le?: string
          emplacement?: Database["public"]["Enums"]["emplacement_boost"]
          fin_le?: string
          id?: string
          montant_cents?: number
          motif_admin?: string | null
          pack?: Database["public"]["Enums"]["pack_boost"]
          prestataire_id?: string
          source?: Database["public"]["Enums"]["source_boost"] | null
          statut?: Database["public"]["Enums"]["statut_boost"]
          stripe_payment_intent_id?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boosts_visibilite_prestataire_id_fkey"
            columns: ["prestataire_id"]
            isOneToOne: false
            referencedRelation: "prestataires"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          contenu_seo: string | null
          created_at: string
          description_seo: string | null
          est_active: boolean | null
          icone_url: string | null
          id: string
          nom: string
          ordre_affichage: number | null
          parent_id: string | null
          photo_url: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          contenu_seo?: string | null
          created_at?: string
          description_seo?: string | null
          est_active?: boolean | null
          icone_url?: string | null
          id?: string
          nom: string
          ordre_affichage?: number | null
          parent_id?: string | null
          photo_url?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          contenu_seo?: string | null
          created_at?: string
          description_seo?: string | null
          est_active?: boolean | null
          icone_url?: string | null
          id?: string
          nom?: string
          ordre_affichage?: number | null
          parent_id?: string | null
          photo_url?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      champs_categories: {
        Row: {
          categorie_id: string
          cle: string
          created_at: string
          id: string
          label: string
          obligatoire: boolean | null
          options_liste: string[] | null
          ordre_affichage: number | null
          type_champ: Database["public"]["Enums"]["type_champ"]
          visible_public: boolean | null
        }
        Insert: {
          categorie_id: string
          cle: string
          created_at?: string
          id?: string
          label: string
          obligatoire?: boolean | null
          options_liste?: string[] | null
          ordre_affichage?: number | null
          type_champ?: Database["public"]["Enums"]["type_champ"]
          visible_public?: boolean | null
        }
        Update: {
          categorie_id?: string
          cle?: string
          created_at?: string
          id?: string
          label?: string
          obligatoire?: boolean | null
          options_liste?: string[] | null
          ordre_affichage?: number | null
          type_champ?: Database["public"]["Enums"]["type_champ"]
          visible_public?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "champs_categories_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts_anonymes: {
        Row: {
          created_at: string
          email: string
          id: string
          mailchimp_id: string | null
          merged_le: string | null
          origine_premiere: string
          prenom: string | null
          profile_id: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          mailchimp_id?: string | null
          merged_le?: string | null
          origine_premiere?: string
          prenom?: string | null
          profile_id?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          mailchimp_id?: string | null
          merged_le?: string | null
          origine_premiere?: string
          prenom?: string | null
          profile_id?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_anonymes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_devis: {
        Row: {
          budget_indicatif: number | null
          contact_id: string
          created_at: string
          date_evenement: string | null
          email_contact: string
          id: string
          lieu_evenement: string | null
          message: string
          nom_contact: string
          nombre_invites_rang: string | null
          objet: Database["public"]["Enums"]["objet_demande"]
          prestataire_id: string
          profile_id: string | null
          source: string | null
          statut: Database["public"]["Enums"]["statut_demande"]
          telephone_contact: string | null
          updated_at: string
        }
        Insert: {
          budget_indicatif?: number | null
          contact_id: string
          created_at?: string
          date_evenement?: string | null
          email_contact: string
          id?: string
          lieu_evenement?: string | null
          message: string
          nom_contact: string
          nombre_invites_rang?: string | null
          objet?: Database["public"]["Enums"]["objet_demande"]
          prestataire_id: string
          profile_id?: string | null
          source?: string | null
          statut?: Database["public"]["Enums"]["statut_demande"]
          telephone_contact?: string | null
          updated_at?: string
        }
        Update: {
          budget_indicatif?: number | null
          contact_id?: string
          created_at?: string
          date_evenement?: string | null
          email_contact?: string
          id?: string
          lieu_evenement?: string | null
          message?: string
          nom_contact?: string
          nombre_invites_rang?: string | null
          objet?: Database["public"]["Enums"]["objet_demande"]
          prestataire_id?: string
          profile_id?: string | null
          source?: string | null
          statut?: Database["public"]["Enums"]["statut_demande"]
          telephone_contact?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandes_devis_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_anonymes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_devis_prestataire_id_fkey"
            columns: ["prestataire_id"]
            isOneToOne: false
            referencedRelation: "prestataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_devis_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_textes: {
        Row: {
          corps: string | null
          created_at: string
          cta_label: string | null
          description: string | null
          display_name: string
          est_actif: boolean
          footer: string | null
          id: string
          intro: string | null
          sujet: string
          template_name: string
          titre: string | null
          updated_at: string
          variables_disponibles: string[] | null
        }
        Insert: {
          corps?: string | null
          created_at?: string
          cta_label?: string | null
          description?: string | null
          display_name: string
          est_actif?: boolean
          footer?: string | null
          id?: string
          intro?: string | null
          sujet: string
          template_name: string
          titre?: string | null
          updated_at?: string
          variables_disponibles?: string[] | null
        }
        Update: {
          corps?: string | null
          created_at?: string
          cta_label?: string | null
          description?: string | null
          display_name?: string
          est_actif?: boolean
          footer?: string | null
          id?: string
          intro?: string | null
          sujet?: string
          template_name?: string
          titre?: string | null
          updated_at?: string
          variables_disponibles?: string[] | null
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      evenements_prestataire: {
        Row: {
          created_at: string
          id: string
          prestataire_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          prestataire_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          prestataire_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "evenements_prestataire_prestataire_id_fkey"
            columns: ["prestataire_id"]
            isOneToOne: false
            referencedRelation: "prestataires"
            referencedColumns: ["id"]
          },
        ]
      }
      favoris: {
        Row: {
          created_at: string
          id: string
          prestataire_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prestataire_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prestataire_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favoris_prestataire_id_fkey"
            columns: ["prestataire_id"]
            isOneToOne: false
            referencedRelation: "prestataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoris_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      historique_navigation: {
        Row: {
          consulte_le: string
          id: string
          nb_consultations: number
          prestataire_id: string
          user_id: string
        }
        Insert: {
          consulte_le?: string
          id?: string
          nb_consultations?: number
          prestataire_id: string
          user_id: string
        }
        Update: {
          consulte_le?: string
          id?: string
          nb_consultations?: number
          prestataire_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historique_navigation_prestataire_id_fkey"
            columns: ["prestataire_id"]
            isOneToOne: false
            referencedRelation: "prestataires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_navigation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_admin: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          entite: string | null
          entite_id: string | null
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          entite?: string | null
          entite_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          entite?: string | null
          entite_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_admin_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          contenu: string
          created_at: string
          demande_id: string
          envoye_par_email: boolean | null
          expediteur_id: string | null
          expediteur_type: Database["public"]["Enums"]["expediteur_type"]
          id: string
          lu_le: string | null
        }
        Insert: {
          contenu: string
          created_at?: string
          demande_id: string
          envoye_par_email?: boolean | null
          expediteur_id?: string | null
          expediteur_type: Database["public"]["Enums"]["expediteur_type"]
          id?: string
          lu_le?: string | null
        }
        Update: {
          contenu?: string
          created_at?: string
          demande_id?: string
          envoye_par_email?: boolean | null
          expediteur_id?: string | null
          expediteur_type?: Database["public"]["Enums"]["expediteur_type"]
          id?: string
          lu_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes_devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_expediteur_id_fkey"
            columns: ["expediteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          corps: string
          created_at: string
          id: string
          lien: string | null
          lu: boolean | null
          titre: string
          type: Database["public"]["Enums"]["type_notification"]
          user_id: string
        }
        Insert: {
          corps: string
          created_at?: string
          id?: string
          lien?: string | null
          lu?: boolean | null
          titre: string
          type: Database["public"]["Enums"]["type_notification"]
          user_id: string
        }
        Update: {
          corps?: string
          created_at?: string
          id?: string
          lien?: string | null
          lu?: boolean | null
          titre?: string
          type?: Database["public"]["Enums"]["type_notification"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pages_contenu: {
        Row: {
          builder_io_content_id: string | null
          created_at: string
          est_publiee: boolean | null
          id: string
          meta_description: string | null
          meta_title: string | null
          slug: string
          titre: string
          updated_at: string
        }
        Insert: {
          builder_io_content_id?: string | null
          created_at?: string
          est_publiee?: boolean | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          slug: string
          titre: string
          updated_at?: string
        }
        Update: {
          builder_io_content_id?: string | null
          created_at?: string
          est_publiee?: boolean | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          slug?: string
          titre?: string
          updated_at?: string
        }
        Relationships: []
      }
      planificateur: {
        Row: {
          created_at: string
          date_evenement: string | null
          donnees: Json
          id: string
          nom_projet: string | null
          type: Database["public"]["Enums"]["type_planificateur"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_evenement?: string | null
          donnees?: Json
          id?: string
          nom_projet?: string | null
          type: Database["public"]["Enums"]["type_planificateur"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_evenement?: string | null
          donnees?: Json
          id?: string
          nom_projet?: string | null
          type?: Database["public"]["Enums"]["type_planificateur"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planificateur_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prestataires: {
        Row: {
          adresse: string | null
          categorie_fille_id: string | null
          categorie_mere_id: string
          champs_specifiques: Json | null
          code_postal: string | null
          created_at: string
          cree_par_admin: boolean | null
          date_premiere_publication: string | null
          description: string | null
          description_courte: string | null
          email_contact: string | null
          est_premium: boolean | null
          est_verifie: boolean | null
          fin_premium: string | null
          fin_visibilite_boost: string | null
          id: string
          latitude: number | null
          longitude: number | null
          metadonnees_seo: Json | null
          motif_suspension: string | null
          nom_commercial: string
          nombre_avis: number | null
          nombre_demandes: number | null
          note_flexibilite: number | null
          note_moyenne: number | null
          note_professionnalisme: number | null
          note_qualite_prestation: number | null
          note_rapport_qualite_prix: number | null
          notes_admin: string | null
          photo_principale_url: string | null
          prix_depart: number | null
          prix_max: number | null
          region: string
          site_web: string | null
          slug: string
          statut: Database["public"]["Enums"]["statut_prestataire"]
          tags: string[] | null
          telephone: string | null
          updated_at: string
          urls_galerie: string[] | null
          user_id: string | null
          video_url: string | null
          ville: string
          zones_intervention: string[] | null
        }
        Insert: {
          adresse?: string | null
          categorie_fille_id?: string | null
          categorie_mere_id: string
          champs_specifiques?: Json | null
          code_postal?: string | null
          created_at?: string
          cree_par_admin?: boolean | null
          date_premiere_publication?: string | null
          description?: string | null
          description_courte?: string | null
          email_contact?: string | null
          est_premium?: boolean | null
          est_verifie?: boolean | null
          fin_premium?: string | null
          fin_visibilite_boost?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadonnees_seo?: Json | null
          motif_suspension?: string | null
          nom_commercial: string
          nombre_avis?: number | null
          nombre_demandes?: number | null
          note_flexibilite?: number | null
          note_moyenne?: number | null
          note_professionnalisme?: number | null
          note_qualite_prestation?: number | null
          note_rapport_qualite_prix?: number | null
          notes_admin?: string | null
          photo_principale_url?: string | null
          prix_depart?: number | null
          prix_max?: number | null
          region: string
          site_web?: string | null
          slug: string
          statut?: Database["public"]["Enums"]["statut_prestataire"]
          tags?: string[] | null
          telephone?: string | null
          updated_at?: string
          urls_galerie?: string[] | null
          user_id?: string | null
          video_url?: string | null
          ville: string
          zones_intervention?: string[] | null
        }
        Update: {
          adresse?: string | null
          categorie_fille_id?: string | null
          categorie_mere_id?: string
          champs_specifiques?: Json | null
          code_postal?: string | null
          created_at?: string
          cree_par_admin?: boolean | null
          date_premiere_publication?: string | null
          description?: string | null
          description_courte?: string | null
          email_contact?: string | null
          est_premium?: boolean | null
          est_verifie?: boolean | null
          fin_premium?: string | null
          fin_visibilite_boost?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadonnees_seo?: Json | null
          motif_suspension?: string | null
          nom_commercial?: string
          nombre_avis?: number | null
          nombre_demandes?: number | null
          note_flexibilite?: number | null
          note_moyenne?: number | null
          note_professionnalisme?: number | null
          note_qualite_prestation?: number | null
          note_rapport_qualite_prix?: number | null
          notes_admin?: string | null
          photo_principale_url?: string | null
          prix_depart?: number | null
          prix_max?: number | null
          region?: string
          site_web?: string | null
          slug?: string
          statut?: Database["public"]["Enums"]["statut_prestataire"]
          tags?: string[] | null
          telephone?: string | null
          updated_at?: string
          urls_galerie?: string[] | null
          user_id?: string | null
          video_url?: string | null
          ville?: string
          zones_intervention?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "prestataires_categorie_fille_id_fkey"
            columns: ["categorie_fille_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestataires_categorie_mere_id_fkey"
            columns: ["categorie_mere_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestataires_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cgu_acceptees_le: string | null
          compte_supprime_le: string | null
          created_at: string
          date_naissance: string | null
          email: string
          id: string
          nom: string | null
          preferences_notifications: Json | null
          prenom: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cgu_acceptees_le?: string | null
          compte_supprime_le?: string | null
          created_at?: string
          date_naissance?: string | null
          email: string
          id: string
          nom?: string | null
          preferences_notifications?: Json | null
          prenom?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cgu_acceptees_le?: string | null
          compte_supprime_le?: string | null
          created_at?: string
          date_naissance?: string | null
          email?: string
          id?: string
          nom?: string | null
          preferences_notifications?: Json | null
          prenom?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_review_prestataire: {
        Args: { p_prestataire_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enregistrer_consultation_prestataire: {
        Args: { p_prestataire_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      purger_historique_navigation: { Args: never; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      soumettre_demande_devis: {
        Args: {
          p_date_evenement?: string
          p_email: string
          p_lieu_evenement?: string
          p_message: string
          p_nom: string
          p_nombre_invites_rang?: string
          p_objet: Database["public"]["Enums"]["objet_demande"]
          p_prestataire_id: string
          p_telephone: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "client" | "prestataire" | "admin" | "super_admin"
      emplacement_boost:
        | "listing_top"
        | "listing_sidebar"
        | "accueil_coups_de_coeur"
      expediteur_type: "prestataire" | "visiteur"
      objet_demande: "mariage" | "evenement_entreprise" | "cocktail" | "autre"
      pack_boost: "5j_5eur" | "15j_12eur" | "30j_20eur"
      plan_abonnement: "essai" | "mensuel" | "annuel"
      source_boost: "prestataire" | "admin"
      statut_abonnement:
        | "actif"
        | "en_retard"
        | "en_pause"
        | "resilie"
        | "annule"
        | "expire"
      statut_avis: "en_attente" | "valide" | "rejete"
      statut_boost: "actif" | "expire" | "rembourse"
      statut_demande:
        | "nouveau"
        | "lu"
        | "en_discussion"
        | "devis_envoye"
        | "accepte"
        | "refuse"
        | "archive"
      statut_prestataire:
        | "brouillon"
        | "en_attente"
        | "a_corriger"
        | "actif"
        | "suspendu"
        | "archive"
      type_champ: "texte" | "nombre" | "booleen" | "liste" | "date"
      type_notification:
        | "nouvelle_demande"
        | "nouveau_message"
        | "avis"
        | "abonnement"
        | "boost"
        | "systeme"
      type_planificateur: "checklist" | "budget" | "invites" | "planning"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["client", "prestataire", "admin", "super_admin"],
      emplacement_boost: [
        "listing_top",
        "listing_sidebar",
        "accueil_coups_de_coeur",
      ],
      expediteur_type: ["prestataire", "visiteur"],
      objet_demande: ["mariage", "evenement_entreprise", "cocktail", "autre"],
      pack_boost: ["5j_5eur", "15j_12eur", "30j_20eur"],
      plan_abonnement: ["essai", "mensuel", "annuel"],
      source_boost: ["prestataire", "admin"],
      statut_abonnement: [
        "actif",
        "en_retard",
        "en_pause",
        "resilie",
        "annule",
        "expire",
      ],
      statut_avis: ["en_attente", "valide", "rejete"],
      statut_boost: ["actif", "expire", "rembourse"],
      statut_demande: [
        "nouveau",
        "lu",
        "en_discussion",
        "devis_envoye",
        "accepte",
        "refuse",
        "archive",
      ],
      statut_prestataire: [
        "brouillon",
        "en_attente",
        "a_corriger",
        "actif",
        "suspendu",
        "archive",
      ],
      type_champ: ["texte", "nombre", "booleen", "liste", "date"],
      type_notification: [
        "nouvelle_demande",
        "nouveau_message",
        "avis",
        "abonnement",
        "boost",
        "systeme",
      ],
      type_planificateur: ["checklist", "budget", "invites", "planning"],
    },
  },
} as const
