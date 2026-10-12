// ============================================================================
// NuhoudTargetActor.h
// ============================================================================
// A 3D interactive target (glowing orb) that the patient hits by
// extending their elbow to the required angle.
//
// When the patient's virtual hand (driven by elbow_angle) enters the
// target's collision sphere, the target calls GameMode->OnTargetHit().
// ============================================================================

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NuhoudTargetActor.generated.h"

UCLASS(Blueprintable, BlueprintType)
class NUHOUD_API ANuhoudTargetActor : public AActor
{
    GENERATED_BODY()

public:
    ANuhoudTargetActor();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    /** Called when the player's virtual hand enters the target's collision. */
    UFUNCTION(BlueprintCallable, Category = "Nuhoud|Target")
    void OnHit();

    /** Is this target still active (not yet hit)? */
    UFUNCTION(BlueprintPure, Category = "Nuhoud|Target")
    bool IsActive() const { return bActive; }

    // -----------------------------------------------------------------------
    // Config
    // -----------------------------------------------------------------------

    /** The target's radius (cm). Smaller = harder. Set by the GameMode on spawn. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nuhoud|Target")
    float Radius = 15.0f;

    /** Whether the target moves (static if speed = 0). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nuhoud|Target")
    float MoveSpeed = 0.0f;

    /** The required elbow angle to "hit" this target (degrees). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Nuhoud|Target")
    float RequiredAngle = 90.0f;

protected:
    /** The visual mesh (glowing sphere). */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Nuhoud|Target|Components")
    UStaticMeshComponent* TargetMesh;

    /** The collision sphere. */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Nuhoud|Target|Components")
    class USphereComponent* CollisionSphere;

    /** Is this target active (waiting to be hit)? */
    bool bActive = true;

    /** Movement direction (for moving targets). */
    FVector MoveDirection = FVector::RightVector;

    /** Movement bounds (the target bounces within this range). */
    FVector MoveBounds = FVector(100.0f, 100.0f, 100.0f);
};
